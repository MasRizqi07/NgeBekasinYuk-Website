import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { generateInternalId } from "@/domain/id";
import {
  LISTING_STATUS,
  TERMINAL_ORDER_STATUSES,
  isPendingOrderExpired,
  type ListingStatus,
} from "@/domain/listing/listingStatus";
import {
  expandConditionFilter,
  getCategoryLabel,
  LISTING_CATEGORY_SLUGS,
} from "@/domain/listing/listingMetadata";
import {
  mapListingToDto,
  type ListingAuthorViewer,
  type ListingPublicDto,
  type ListingRawRow,
} from "@/domain/listing/listingDto";
import {
  CreateListingSchema,
  ListListingsQuerySchema,
  UpdateListingSchema,
} from "@/lib/validations";
import {
  MAX_LISTING_IMAGES_PER_LISTING,
  validateUploadedImageBuffer,
  ImageValidationError,
} from "@/lib/storage/imageValidation";
import { generateSafeImageStorageKey } from "@/lib/storage/StorageProvider";
import { defaultListingStorage } from "@/lib/storage/LocalDiskProvider";

export class ListingServiceError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly title: string;

  constructor(code: string, title: string, message: string, status: number) {
    super(message);
    this.name = "ListingServiceError";
    this.code = code;
    this.title = title;
    this.status = status;
  }
}

export interface ListListingsInput {
  q?: string;
  category?: string;
  condition?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sellerId?: string;
  status?: ListingStatus;
  mine?: boolean;
  canNego?: boolean;
  verifiedOnly?: boolean;
  city?: string;
  ids?: string[];
  sort?: "newest" | "price_asc" | "price_desc" | "popular";
  limit?: number;
  cursor?: string;
}

export interface ListListingsResult {
  data: ListingPublicDto[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

const CursorPayloadSchema = z.object({
  sort: z.enum(["newest", "price_asc", "price_desc", "popular"]),
  createdAt: z.string().datetime(),
  id: z.string().min(1),
  price: z.number().int().optional(),
  viewsCount: z.number().int().optional(),
});

type CursorPayload = z.infer<typeof CursorPayloadSchema>;

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(
  cursor: string,
  expectedSort: CursorPayload["sort"]
): CursorPayload {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = CursorPayloadSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.sort !== expectedSort) {
      throw new Error("Invalid cursor payload");
    }
    return parsed.data;
  } catch {
    throw new ListingServiceError(
      "INVALID_CURSOR",
      "Cursor Tidak Valid",
      "Parameter cursor paginasi tidak valid atau tidak sesuai urutan.",
      400
    );
  }
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return base || "gadget";
}

function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, "\\$&");
}

function selectListingColumnsFragment(): Prisma.Sql {
  return Prisma.sql`
    SELECT
      l."id",
      l."slug",
      l."title",
      l."description",
      l."price",
      l."originalPrice",
      l."category",
      l."categoryLabel",
      l."brand",
      l."model",
      l."condition",
      l."canNego",
      l."minNegoPrice",
      l."status",
      l."sellerId",
      l."viewsCount",
      l."favoritesCount",
      l."createdAt",
      l."updatedAt",
      u."name" AS "sellerName",
      u."avatar" AS "sellerAvatar",
      u."isVerified" AS "sellerIsVerified",
      u."createdAt" AS "sellerCreatedAt",
      sp."storeName" AS "storeName",
      sp."storeSlug" AS "storeSlug",
      sp."city" AS "storeCity",
      sp."rating" AS "storeRating",
      sp."totalSales" AS "storeTotalSales",
      sp."reputationBadge" AS "storeBadge",
      COALESCE(
        ARRAY(
          SELECT li."url"
          FROM "ListingImage" li
          WHERE li."listingId" = l."id"
          ORDER BY li."isPrimary" DESC, li."sortOrder" ASC, li."createdAt" ASC
        ),
        ARRAY[]::text[]
      ) AS "images"
    FROM "ProductListing" l
    INNER JOIN "User" u ON u."id" = l."sellerId"
    LEFT JOIN "SellerProfile" sp ON sp."userId" = u."id"
  `;
}

/**
 * Fetches a single listing row (1 SQL query) using Prisma's SELECT builder.
 */
async function fetchListingRowById(id: string): Promise<ListingRawRow | null> {
  const rows = await prisma.$queryRaw<ListingRawRow[]>`
    ${selectListingColumnsFragment()}
    WHERE l."id" = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export function parseListListingsQuery(
  searchParams: URLSearchParams
): ListListingsInput {
  const rawObject = Object.fromEntries(searchParams.entries());
  const parsed = ListListingsQuerySchema.safeParse(rawObject);
  if (!parsed.success) {
    throw new ListingServiceError(
      "VALIDATION_ERROR",
      "Parameter Query Tidak Valid",
      "Parameter pencarian atau filter tidak valid.",
      400
    );
  }

  const data = parsed.data;
  if (
    data.minPrice !== undefined &&
    data.maxPrice !== undefined &&
    data.minPrice > data.maxPrice
  ) {
    throw new ListingServiceError(
      "INVALID_PRICE_RANGE",
      "Rentang Harga Tidak Valid",
      "minPrice tidak boleh melebihi maxPrice.",
      400
    );
  }

  let ids: string[] | undefined;
  if (data.ids) {
    ids = Array.from(
      new Set(
        data.ids
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
    if (ids.length === 0) {
      ids = undefined;
    } else if (ids.length > 20) {
      throw new ListingServiceError(
        "TOO_MANY_IDS",
        "Terlalu Banyak ID",
        "Maksimal 20 listing ID per permintaan batch.",
        400
      );
    }
  }

  if (
    data.category &&
    data.category !== "all" &&
    !(LISTING_CATEGORY_SLUGS as readonly string[]).includes(data.category)
  ) {
    throw new ListingServiceError(
      "INVALID_CATEGORY",
      "Kategori Tidak Valid",
      "Kategori gadget yang dipilih tidak dikenal.",
      400
    );
  }

  return {
    q: data.q,
    category: data.category === "all" ? undefined : data.category,
    condition: data.condition,
    brand: data.brand,
    minPrice: data.minPrice,
    maxPrice: data.maxPrice,
    sellerId: data.sellerId,
    status: data.status as ListingStatus | undefined,
    mine: data.mine === "true" || data.mine === "1",
    canNego:
      data.canNego === undefined
        ? undefined
        : data.canNego === "true" || data.canNego === "1",
    verifiedOnly:
      data.verifiedOnly === undefined
        ? undefined
        : data.verifiedOnly === "true" || data.verifiedOnly === "1",
    city: data.city && data.city !== "Semua Kota" ? data.city : undefined,
    ids,
    sort: data.sort,
    limit: data.limit,
    cursor: data.cursor,
  };
}

/**
 * Lazily cancels expired unpaid PENDING_PAYMENT orders on RESERVED listings
 * and restores listing status to ACTIVE if no non-terminal order remains.
 * Runs a single precheck query when nothing is expired so GET /api/listings stays <= 3 queries.
 */
export async function reconcileExpiredReservations(listingId?: string): Promise<number> {
  const candidates = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT DISTINCT o."id"
    FROM "Order" o
    INNER JOIN "ProductListing" l ON l."id" = o."listingId"
    WHERE l."status" = 'RESERVED'
      AND o."status" = 'PENDING_PAYMENT'
      ${listingId ? Prisma.sql`AND l."id" = ${listingId}` : Prisma.empty}
      AND (
        o."createdAt" < (NOW() AT TIME ZONE 'UTC' - INTERVAL '2 hours')
        OR EXISTS (
          SELECT 1
          FROM "PaymentAttempt" pa
          WHERE pa."orderId" = o."id"
            AND pa."id" = (
              SELECT pa2."id"
              FROM "PaymentAttempt" pa2
              WHERE pa2."orderId" = o."id"
              ORDER BY pa2."createdAt" DESC
              LIMIT 1
            )
            AND pa."status" = 'PENDING'
            AND pa."expiresAt" < (NOW() AT TIME ZONE 'UTC')
        )
      )
    LIMIT 20
  `;

  if (candidates.length === 0) {
    return 0;
  }

  let recoveredCount = 0;

  for (const candidate of candidates) {
    const recovered = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: candidate.id },
        include: {
          paymentAttempts: {
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!order || !isPendingOrderExpired(order)) {
        return false;
      }

      const cancelResult = await tx.order.updateMany({
        where: {
          id: order.id,
          status: "PENDING_PAYMENT",
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      });

      if (cancelResult.count !== 1) {
        return false;
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: "PENDING_PAYMENT",
          toStatus: "CANCELLED",
          actorId: "SYSTEM",
          actorRole: "SYSTEM",
          reason: "Batas waktu pembayaran pesanan telah kadaluwarsa (lazy expiry).",
        },
      });

      await tx.paymentAttempt.updateMany({
        where: {
          orderId: order.id,
          status: "PENDING",
        },
        data: { status: "EXPIRED" },
      });

      const activeBlocking = await tx.order.findFirst({
        where: {
          listingId: order.listingId,
          status: { notIn: [...TERMINAL_ORDER_STATUSES] },
        },
        select: { id: true },
      });

      if (!activeBlocking) {
        const restored = await tx.productListing.updateMany({
          where: {
            id: order.listingId,
            status: LISTING_STATUS.RESERVED,
          },
          data: {
            status: LISTING_STATUS.ACTIVE,
          },
        });
        return restored.count > 0;
      }

      return false;
    });

    if (recovered) {
      recoveredCount++;
    }
  }

  return recoveredCount;
}

/**
 * Shared server-side listing catalog query used by both GET /api/listings and Server Components.
 * Executes a <= 3 SQL query budget with deterministic keyset pagination.
 */
export async function listListings(
  params: ListListingsInput = {},
  viewer?: ListingAuthorViewer | null
): Promise<ListListingsResult> {
  const sort = params.sort ?? "newest";
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);

  if (params.mine && !viewer) {
    throw new ListingServiceError(
      "UNAUTHORIZED",
      "Autentikasi Diperlukan",
      "Silakan login untuk melihat daftar iklan Anda.",
      401
    );
  }

  // Reconcile expired unpaid reservations before querying public catalog so stranded items recover to ACTIVE.
  if (!params.status || params.status === LISTING_STATUS.ACTIVE) {
    await reconcileExpiredReservations();
  }

  const targetSellerId = params.mine ? viewer!.id : params.sellerId;
  const canViewNonPublic =
    Boolean(viewer) &&
    ((Boolean(targetSellerId) && viewer!.id === targetSellerId) ||
      viewer!.role === "ADMIN");

  if (params.status && params.status !== LISTING_STATUS.ACTIVE && !canViewNonPublic) {
    // Do not leak ARCHIVED or non-ACTIVE listings through public catalog queries.
    return {
      data: [],
      pagination: { limit, nextCursor: null, hasMore: false },
    };
  }

  const conditions: Prisma.Sql[] = [];

  if (params.status) {
    conditions.push(Prisma.sql`l."status" = ${params.status}`);
  } else if (params.mine) {
    conditions.push(
      Prisma.sql`l."status" IN ('ACTIVE', 'RESERVED', 'SOLD', 'ARCHIVED')`
    );
  } else {
    conditions.push(Prisma.sql`l."status" = 'ACTIVE'`);
  }

  if (targetSellerId) {
    conditions.push(Prisma.sql`l."sellerId" = ${targetSellerId}`);
  }

  if (params.ids && params.ids.length > 0) {
    conditions.push(Prisma.sql`l."id" IN (${Prisma.join(params.ids)})`);
  }

  if (params.category && params.category !== "all") {
    conditions.push(Prisma.sql`l."category" = ${params.category}`);
  }

  if (params.brand) {
    const escapedBrand = escapeLikePattern(params.brand.trim());
    conditions.push(
      Prisma.sql`l."brand" ILIKE ${`%${escapedBrand}%`} ESCAPE '\\'`
    );
  }

  if (params.condition) {
    const expanded = expandConditionFilter(params.condition);
    if (expanded.length === 0) {
      return {
        data: [],
        pagination: { limit, nextCursor: null, hasMore: false },
      };
    }
    conditions.push(Prisma.sql`l."condition" IN (${Prisma.join(expanded)})`);
  }

  if (params.minPrice !== undefined) {
    conditions.push(Prisma.sql`l."price" >= ${params.minPrice}`);
  }

  if (params.maxPrice !== undefined) {
    conditions.push(Prisma.sql`l."price" <= ${params.maxPrice}`);
  }

  if (params.canNego !== undefined) {
    conditions.push(Prisma.sql`l."canNego" = ${params.canNego}`);
  }

  if (params.verifiedOnly) {
    conditions.push(Prisma.sql`u."isVerified" = true`);
  }

  if (params.city) {
    const escapedCity = escapeLikePattern(params.city.trim());
    conditions.push(
      Prisma.sql`sp."city" ILIKE ${`%${escapedCity}%`} ESCAPE '\\'`
    );
  }

  if (params.q && params.q.trim().length > 0) {
    const escapedQ = escapeLikePattern(params.q.trim());
    const pattern = `%${escapedQ}%`;
    conditions.push(
      Prisma.sql`(l."title" ILIKE ${pattern} ESCAPE '\\' OR l."brand" ILIKE ${pattern} ESCAPE '\\' OR l."model" ILIKE ${pattern} ESCAPE '\\' OR l."description" ILIKE ${pattern} ESCAPE '\\')`
    );
  }

  if (params.cursor) {
    const c = decodeCursor(params.cursor, sort);
    // Normalize ISO instant to UTC timestamp without timezone to match Prisma's TIMESTAMP(3) column regardless of PG TimeZone.
    const cursorTs = Prisma.sql`(${c.createdAt}::timestamptz AT TIME ZONE 'UTC')`;

    if (sort === "newest") {
      // Bound upper timestamp first so PostgreSQL leverages ProductListing_status_createdAt_id_idx.
      conditions.push(
        Prisma.sql`l."createdAt" <= ${cursorTs} AND (l."createdAt" < ${cursorTs} OR l."id" > ${c.id})`
      );
    } else if (sort === "price_asc") {
      if (c.price === undefined) {
        throw new ListingServiceError(
          "INVALID_CURSOR",
          "Cursor Tidak Valid",
          "Cursor harga tidak lengkap.",
          400
        );
      }
      conditions.push(
        Prisma.sql`(l."price" > ${c.price} OR (l."price" = ${c.price} AND (l."createdAt" < ${cursorTs} OR (l."createdAt" = ${cursorTs} AND l."id" > ${c.id}))))`
      );
    } else if (sort === "price_desc") {
      if (c.price === undefined) {
        throw new ListingServiceError(
          "INVALID_CURSOR",
          "Cursor Tidak Valid",
          "Cursor harga tidak lengkap.",
          400
        );
      }
      conditions.push(
        Prisma.sql`(l."price" < ${c.price} OR (l."price" = ${c.price} AND (l."createdAt" < ${cursorTs} OR (l."createdAt" = ${cursorTs} AND l."id" > ${c.id}))))`
      );
    } else {
      if (c.viewsCount === undefined) {
        throw new ListingServiceError(
          "INVALID_CURSOR",
          "Cursor Tidak Valid",
          "Cursor popularitas tidak lengkap.",
          400
        );
      }
      conditions.push(
        Prisma.sql`(l."viewsCount" < ${c.viewsCount} OR (l."viewsCount" = ${c.viewsCount} AND (l."createdAt" < ${cursorTs} OR (l."createdAt" = ${cursorTs} AND l."id" > ${c.id}))))`
      );
    }
  }

  let orderBySql: Prisma.Sql;
  if (sort === "price_asc") {
    orderBySql = Prisma.sql`ORDER BY l."price" ASC, l."createdAt" DESC, l."id" ASC`;
  } else if (sort === "price_desc") {
    orderBySql = Prisma.sql`ORDER BY l."price" DESC, l."createdAt" DESC, l."id" ASC`;
  } else if (sort === "popular") {
    orderBySql = Prisma.sql`ORDER BY l."viewsCount" DESC, l."createdAt" DESC, l."id" ASC`;
  } else {
    orderBySql = Prisma.sql`ORDER BY l."createdAt" DESC, l."id" ASC`;
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  const rows = await prisma.$queryRaw<ListingRawRow[]>`
    ${selectListingColumnsFragment()}
    ${whereClause}
    ${orderBySql}
    LIMIT ${limit + 1}
  `;

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  const nextCursor =
    hasMore && lastRow
      ? encodeCursor({
          sort,
          createdAt: new Date(lastRow.createdAt).toISOString(),
          id: lastRow.id,
          ...(sort === "price_asc" || sort === "price_desc"
            ? { price: lastRow.price }
            : {}),
          ...(sort === "popular" ? { viewsCount: lastRow.viewsCount } : {}),
        })
      : null;

  return {
    data: pageRows.map((row) => mapListingToDto(row, viewer)),
    pagination: {
      limit,
      nextCursor,
      hasMore,
    },
  };
}

export async function getListingByIdOrSlug(
  idOrSlug: string,
  viewer?: ListingAuthorViewer | null
): Promise<ListingPublicDto | null> {
  let rows = await prisma.$queryRaw<ListingRawRow[]>`
    ${selectListingColumnsFragment()}
    WHERE l."id" = ${idOrSlug} OR l."slug" = ${idOrSlug}
    LIMIT 1
  `;
  let row = rows[0];
  if (!row) {
    return null;
  }

  if (row.status === LISTING_STATUS.RESERVED) {
    const recovered = await reconcileExpiredReservations(row.id);
    if (recovered > 0) {
      rows = await prisma.$queryRaw<ListingRawRow[]>`
        ${selectListingColumnsFragment()}
        WHERE l."id" = ${row.id}
        LIMIT 1
      `;
      row = rows[0] ?? row;
    }
  }

  if (row.status === LISTING_STATUS.ARCHIVED) {
    const canSeeArchived =
      Boolean(viewer) &&
      (viewer!.id === row.sellerId || viewer!.role === "ADMIN");
    if (!canSeeArchived) {
      return null;
    }
  }

  return mapListingToDto(row, viewer);
}

export async function createListing(params: {
  actor: { id: string; name: string; role: string };
  rawBody: unknown;
  idempotencyKey: string | null;
}): Promise<{ listing: ListingPublicDto; replayed: boolean }> {
  const key = params.idempotencyKey?.trim();
  if (!key) {
    throw new ListingServiceError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key Diperlukan",
      "Header Idempotency-Key wajib disertakan untuk pembuatan iklan.",
      400
    );
  }

  const scopedKey = `listing:create:${key}`;
  const existingKey = await prisma.idempotencyKey.findUnique({
    where: { key: scopedKey },
  });

  if (existingKey && new Date() < existingKey.expiresAt && existingKey.resourceId) {
    const existingRow = await fetchListingRowById(existingKey.resourceId);
    if (existingRow) {
      if (existingRow.sellerId !== params.actor.id && params.actor.role !== "ADMIN") {
        throw new ListingServiceError(
          "FORBIDDEN",
          "Akses Ditolak",
          "Anda tidak memiliki akses ke kunci idempotensi ini.",
          403
        );
      }
      return {
        listing: mapListingToDto(existingRow, params.actor),
        replayed: true,
      };
    }
  }

  const validated = CreateListingSchema.safeParse(params.rawBody);
  if (!validated.success) {
    throw new ListingServiceError(
      "VALIDATION_ERROR",
      "Data Iklan Tidak Valid",
      validated.error.issues[0]?.message ||
        "Data iklan tidak valid atau terdapat atribut terlarang.",
      400
    );
  }

  const input = validated.data;
  const newListingId = generateInternalId("list");
  const slugSuffix = crypto.randomBytes(3).toString("hex");
  const slug = `${slugify(input.title)}-${slugSuffix}`;
  const categoryLabel = getCategoryLabel(input.category);

  try {
    await prisma.$transaction(async (tx) => {
      // Auto-provision SellerProfile on a user's first listing creation.
      const existingProfile = await tx.sellerProfile.findUnique({
        where: { userId: params.actor.id },
        select: { id: true },
      });

      if (!existingProfile) {
        const storeSuffix = crypto.randomBytes(3).toString("hex");
        await tx.sellerProfile.create({
          data: {
            userId: params.actor.id,
            storeName: params.actor.name,
            storeSlug: `${slugify(params.actor.name)}-${storeSuffix}`,
            city: "Jakarta Selatan",
            rating: 5.0,
            totalSales: 0,
            reputationBadge: "NEW_SELLER",
          },
        });
      }

      const initialStatus = input.deferPublish
        ? LISTING_STATUS.ARCHIVED
        : LISTING_STATUS.ACTIVE;

      await tx.productListing.create({
        data: {
          id: newListingId,
          slug,
          title: input.title,
          description: input.description,
          price: input.price,
          originalPrice: input.originalPrice ?? null,
          category: input.category,
          categoryLabel,
          brand: input.brand,
          model: input.model,
          condition: input.condition,
          canNego: input.canNego,
          minNegoPrice: input.canNego ? (input.minNegoPrice ?? null) : null,
          status: initialStatus,
          sellerId: params.actor.id,
          ...(input.images && input.images.length > 0
            ? {
                images: {
                  create: input.images.map((url, idx) => ({
                    url,
                    isPrimary: idx === 0,
                    sortOrder: idx,
                  })),
                },
              }
            : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: params.actor.id,
          action: "LISTING_CREATED",
          targetType: "ProductListing",
          targetId: newListingId,
          details: JSON.stringify({
            actorRole: params.actor.role,
            status: initialStatus,
            price: input.price,
            category: input.category,
          }),
        },
      });

      await tx.idempotencyKey.create({
        data: {
          key: scopedKey,
          resource: "LISTING",
          resourceId: newListingId,
          action: "CREATE",
          result: JSON.stringify({ id: newListingId }),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const racedKey = await prisma.idempotencyKey.findUnique({
        where: { key: scopedKey },
      });
      if (racedKey?.resourceId) {
        const existingRow = await fetchListingRowById(racedKey.resourceId);
        if (existingRow) {
          if (
            existingRow.sellerId !== params.actor.id &&
            params.actor.role !== "ADMIN"
          ) {
            throw new ListingServiceError(
              "FORBIDDEN",
              "Akses Ditolak",
              "Anda tidak memiliki akses ke kunci idempotensi ini.",
              403
            );
          }
          return {
            listing: mapListingToDto(existingRow, params.actor),
            replayed: true,
          };
        }
      }
    }
    throw err;
  }

  const createdRow = await fetchListingRowById(newListingId);
  if (!createdRow) {
    throw new Error("Created listing could not be loaded");
  }

  return {
    listing: mapListingToDto(createdRow, params.actor),
    replayed: false,
  };
}

export async function updateListing(params: {
  id: string;
  actor: { id: string; role: string };
  rawBody: unknown;
}): Promise<ListingPublicDto> {
  const validated = UpdateListingSchema.safeParse(params.rawBody);
  if (!validated.success) {
    throw new ListingServiceError(
      "VALIDATION_ERROR",
      "Data Pembaruan Tidak Valid",
      validated.error.issues[0]?.message ||
        "Data pembaruan iklan tidak valid atau terdapat atribut terlarang.",
      400
    );
  }

  const input = validated.data;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.productListing.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        sellerId: true,
        status: true,
        price: true,
        originalPrice: true,
        minNegoPrice: true,
      },
    });

    if (!existing) {
      throw new ListingServiceError(
        "NOT_FOUND",
        "Iklan Tidak Ditemukan",
        "Iklan yang dimaksud tidak ditemukan.",
        404
      );
    }

    if (existing.sellerId !== params.actor.id && params.actor.role !== "ADMIN") {
      throw new ListingServiceError(
        "FORBIDDEN",
        "Akses Ditolak",
        "Anda bukan pemilik iklan ini.",
        403
      );
    }

    const activeOrder = await tx.order.findFirst({
      where: {
        listingId: existing.id,
        status: { notIn: [...TERMINAL_ORDER_STATUSES] },
      },
      select: { id: true, status: true },
    });

    if (activeOrder) {
      throw new ListingServiceError(
        "ACTIVE_ORDER_EXISTS",
        "Pesanan Aktif Sedang Berjalan",
        "Iklan tidak dapat diubah saat masih memiliki pesanan aktif.",
        409
      );
    }

    if (existing.status !== LISTING_STATUS.ACTIVE) {
      throw new ListingServiceError(
        "LISTING_NOT_EDITABLE",
        "Iklan Tidak Dapat Diubah",
        "Hanya iklan berstatus ACTIVE yang dapat diperbarui.",
        409
      );
    }

    const effectivePrice = input.price ?? existing.price;
    const effectiveMinNego =
      input.minNegoPrice !== undefined
        ? input.minNegoPrice
        : existing.minNegoPrice;
    const effectiveOriginalPrice =
      input.originalPrice !== undefined
        ? input.originalPrice
        : existing.originalPrice;

    if (effectiveMinNego != null && effectiveMinNego > effectivePrice) {
      throw new ListingServiceError(
        "VALIDATION_ERROR",
        "Harga Nego Tidak Valid",
        "Harga minimum nego tidak boleh melebihi harga jual.",
        400
      );
    }

    if (
      effectiveOriginalPrice != null &&
      effectiveOriginalPrice < effectivePrice
    ) {
      throw new ListingServiceError(
        "VALIDATION_ERROR",
        "Harga Coret Tidak Valid",
        "Harga coret harus >= harga jual.",
        400
      );
    }

    const updateData: Prisma.ProductListingUpdateManyMutationInput = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.originalPrice !== undefined)
      updateData.originalPrice = input.originalPrice;
    if (input.category !== undefined) {
      updateData.category = input.category;
      updateData.categoryLabel = getCategoryLabel(input.category);
    }
    if (input.brand !== undefined) updateData.brand = input.brand;
    if (input.model !== undefined) updateData.model = input.model;
    if (input.condition !== undefined) updateData.condition = input.condition;
    if (input.canNego !== undefined) updateData.canNego = input.canNego;
    if (input.minNegoPrice !== undefined)
      updateData.minNegoPrice = input.minNegoPrice;

    const updated = await tx.productListing.updateMany({
      where: {
        id: existing.id,
        status: LISTING_STATUS.ACTIVE,
      },
      data: updateData,
    });

    if (updated.count === 0) {
      throw new ListingServiceError(
        "CONCURRENT_MODIFICATION",
        "Konflik Pembaruan",
        "Status iklan berubah saat pembaruan berlangsung.",
        409
      );
    }

    await tx.auditLog.create({
      data: {
        userId: params.actor.id,
        action: "LISTING_UPDATED",
        targetType: "ProductListing",
        targetId: existing.id,
        details: JSON.stringify({
          actorRole: params.actor.role,
          before: { price: existing.price, status: existing.status },
          after: updateData,
        }),
      },
    });
  });

  const updatedRow = await fetchListingRowById(params.id);
  if (!updatedRow) {
    throw new Error("Updated listing could not be loaded");
  }
  return mapListingToDto(updatedRow, params.actor);
}

export async function archiveListing(params: {
  id: string;
  actor: { id: string; role: string };
}): Promise<ListingPublicDto> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.productListing.findUnique({
      where: { id: params.id },
      select: { id: true, sellerId: true, status: true },
    });

    if (!existing) {
      throw new ListingServiceError(
        "NOT_FOUND",
        "Iklan Tidak Ditemukan",
        "Iklan yang dimaksud tidak ditemukan.",
        404
      );
    }

    if (existing.sellerId !== params.actor.id && params.actor.role !== "ADMIN") {
      throw new ListingServiceError(
        "FORBIDDEN",
        "Akses Ditolak",
        "Anda bukan pemilik iklan ini.",
        403
      );
    }

    const activeOrder = await tx.order.findFirst({
      where: {
        listingId: existing.id,
        status: { notIn: [...TERMINAL_ORDER_STATUSES] },
      },
      select: { id: true },
    });

    if (activeOrder) {
      throw new ListingServiceError(
        "ACTIVE_ORDER_EXISTS",
        "Pesanan Aktif Sedang Berjalan",
        "Iklan tidak dapat diarsipkan saat masih memiliki pesanan aktif.",
        409
      );
    }

    if (existing.status === LISTING_STATUS.ARCHIVED) {
      return;
    }

    const res = await tx.productListing.updateMany({
      where: {
        id: existing.id,
        status: LISTING_STATUS.ACTIVE,
      },
      data: { status: LISTING_STATUS.ARCHIVED },
    });

    if (res.count === 0) {
      throw new ListingServiceError(
        "INVALID_LISTING_STATE",
        "Iklan Tidak Dapat Diarsipkan",
        "Hanya iklan berstatus ACTIVE tanpa pesanan aktif yang dapat diarsipkan.",
        409
      );
    }

    await tx.auditLog.create({
      data: {
        userId: params.actor.id,
        action: "LISTING_ARCHIVED",
        targetType: "ProductListing",
        targetId: existing.id,
        details: JSON.stringify({
          actorRole: params.actor.role,
          beforeStatus: existing.status,
          afterStatus: LISTING_STATUS.ARCHIVED,
        }),
      },
    });
  });

  const row = await fetchListingRowById(params.id);
  if (!row) {
    throw new Error("Archived listing could not be loaded");
  }
  return mapListingToDto(row, params.actor);
}

export async function relistListing(params: {
  id: string;
  actor: { id: string; role: string };
}): Promise<ListingPublicDto> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.productListing.findUnique({
      where: { id: params.id },
      select: { id: true, sellerId: true, status: true },
    });

    if (!existing) {
      throw new ListingServiceError(
        "NOT_FOUND",
        "Iklan Tidak Ditemukan",
        "Iklan yang dimaksud tidak ditemukan.",
        404
      );
    }

    if (existing.sellerId !== params.actor.id && params.actor.role !== "ADMIN") {
      throw new ListingServiceError(
        "FORBIDDEN",
        "Akses Ditolak",
        "Anda bukan pemilik iklan ini.",
        403
      );
    }

    const activeOrder = await tx.order.findFirst({
      where: {
        listingId: existing.id,
        status: { notIn: [...TERMINAL_ORDER_STATUSES] },
      },
      select: { id: true },
    });

    if (activeOrder) {
      throw new ListingServiceError(
        "ACTIVE_ORDER_EXISTS",
        "Pesanan Aktif Sedang Berjalan",
        "Iklan tidak dapat ditayangkan ulang selama masih memiliki pesanan aktif.",
        409
      );
    }

    const res = await tx.productListing.updateMany({
      where: {
        id: existing.id,
        status: LISTING_STATUS.ARCHIVED,
      },
      data: { status: LISTING_STATUS.ACTIVE },
    });

    if (res.count === 0) {
      throw new ListingServiceError(
        "INVALID_LISTING_STATE",
        "Iklan Tidak Dapat Ditayangkan Ulang",
        "Hanya iklan berstatus ARCHIVED tanpa pesanan aktif yang dapat ditayangkan ulang.",
        409
      );
    }

    await tx.auditLog.create({
      data: {
        userId: params.actor.id,
        action: "LISTING_RELISTED",
        targetType: "ProductListing",
        targetId: existing.id,
        details: JSON.stringify({
          actorRole: params.actor.role,
          beforeStatus: existing.status,
          afterStatus: LISTING_STATUS.ACTIVE,
        }),
      },
    });
  });

  const row = await fetchListingRowById(params.id);
  if (!row) {
    throw new Error("Relisted listing could not be loaded");
  }
  return mapListingToDto(row, params.actor);
}

/**
 * Authorizes listing image upload before any multipart body is buffered in memory.
 */
export async function authorizeListingImageUpload(params: {
  listingId: string;
  actor: { id: string; role: string };
}): Promise<void> {
  const listing = await prisma.productListing.findUnique({
    where: { id: params.listingId },
    select: {
      id: true,
      sellerId: true,
      status: true,
      _count: { select: { images: true } },
    },
  });

  if (!listing) {
    throw new ListingServiceError(
      "NOT_FOUND",
      "Iklan Tidak Ditemukan",
      "Iklan yang dimaksud tidak ditemukan.",
      404
    );
  }

  if (listing.sellerId !== params.actor.id && params.actor.role !== "ADMIN") {
    throw new ListingServiceError(
      "FORBIDDEN",
      "Akses Ditolak",
      "Anda bukan pemilik iklan ini.",
      403
    );
  }

  if (listing._count.images >= MAX_LISTING_IMAGES_PER_LISTING) {
    throw new ListingServiceError(
      "MAX_IMAGES_EXCEEDED",
      "Batas Foto Tercapai",
      `Maksimal ${MAX_LISTING_IMAGES_PER_LISTING} foto per iklan.`,
      400
    );
  }
}

export async function attachListingImage(params: {
  listingId: string;
  actor: { id: string; role: string };
  buffer: Buffer;
  claimedMimeType?: string | null;
  idempotencyKey?: string | null;
}): Promise<{ id: string; url: string; isPrimary: boolean; sortOrder: number }> {
  const cleanKey = params.idempotencyKey?.trim();
  const scopedKey = cleanKey
    ? `listing:img:${params.listingId}:${params.actor.id}:${cleanKey}`
    : null;

  if (scopedKey) {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key: scopedKey },
    });
    if (existing && new Date() < existing.expiresAt && existing.resourceId) {
      const existingImage = await prisma.listingImage.findFirst({
        where: { id: existing.resourceId, listingId: params.listingId },
        select: { id: true, url: true, isPrimary: true, sortOrder: true },
      });
      if (existingImage) {
        return existingImage;
      }
    }
  }

  let validated;
  try {
    validated = validateUploadedImageBuffer(params.buffer, params.claimedMimeType);
  } catch (err) {
    if (err instanceof ImageValidationError) {
      throw new ListingServiceError(err.code, "Gambar Tidak Valid", err.message, err.status);
    }
    throw err;
  }

  await authorizeListingImageUpload({
    listingId: params.listingId,
    actor: params.actor,
  });

  const key = generateSafeImageStorageKey(validated.extension);
  const stored = await defaultListingStorage.put(key, params.buffer, validated.mimeType);

  try {
    const createdImage = await prisma.$transaction(async (tx) => {
      const count = await tx.listingImage.count({
        where: { listingId: params.listingId },
      });

      if (count >= MAX_LISTING_IMAGES_PER_LISTING) {
        throw new ListingServiceError(
          "MAX_IMAGES_EXCEEDED",
          "Batas Foto Tercapai",
          `Maksimal ${MAX_LISTING_IMAGES_PER_LISTING} foto per iklan.`,
          400
        );
      }

      const imageRow = await tx.listingImage.create({
        data: {
          listingId: params.listingId,
          url: stored.url,
          isPrimary: count === 0,
          sortOrder: count,
        },
        select: {
          id: true,
          url: true,
          isPrimary: true,
          sortOrder: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: params.actor.id,
          action: "LISTING_IMAGE_UPLOADED",
          targetType: "ListingImage",
          targetId: imageRow.id,
          details: JSON.stringify({
            actorRole: params.actor.role,
            listingId: params.listingId,
            url: stored.url,
            mimeType: validated.mimeType,
            size: validated.size,
          }),
        },
      });

      if (scopedKey) {
        await tx.idempotencyKey.create({
          data: {
            key: scopedKey,
            resource: "ListingImage",
            resourceId: imageRow.id,
            action: "UPLOAD",
            result: JSON.stringify({ id: imageRow.id, url: imageRow.url }),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      return imageRow;
    });

    return createdImage;
  } catch (err) {
    await defaultListingStorage.delete(key);
    if (
      scopedKey &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const raced = await prisma.idempotencyKey.findUnique({
        where: { key: scopedKey },
      });
      if (raced?.resourceId) {
        const img = await prisma.listingImage.findFirst({
          where: { id: raced.resourceId, listingId: params.listingId },
          select: { id: true, url: true, isPrimary: true, sortOrder: true },
        });
        if (img) return img;
      }
    }
    throw err;
  }
}
