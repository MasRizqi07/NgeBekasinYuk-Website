import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { generateInternalId } from "@/domain/id";
import { LISTING_STATUS } from "@/domain/listing/listingStatus";
import {
  CreateConversationSchema,
  ListConversationsQuerySchema,
  ListMessagesQuerySchema,
  SendMessageSchema,
} from "@/lib/validations";
import {
  ChatDomainError,
  chatListingSelect,
  chatOfferSelect,
  chatParticipantSelect,
  decodeTimeIdCursor,
  encodeTimeIdCursor,
  mapConversationToDto,
  mapMessageToDto,
  mapOfferToDto,
} from "@/domain/chat/chatDto";

export interface ChatViewer {
  id: string;
  name: string;
  role: string;
}

const conversationInclude = {
  buyer: { select: chatParticipantSelect },
  seller: { select: chatParticipantSelect },
  listing: { select: chatListingSelect },
  offers: {
    select: chatOfferSelect,
    orderBy: { createdAt: "desc" as const },
  },
  messages: {
    select: {
      id: true,
      senderId: true,
      senderName: true,
      text: true,
      imageUrl: true,
      offerId: true,
      isRead: true,
      createdAt: true,
      offer: { select: chatOfferSelect },
    },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.ConversationInclude;

const conversationSummaryInclude = {
  buyer: { select: chatParticipantSelect },
  seller: { select: chatParticipantSelect },
  listing: { select: chatListingSelect },
  offers: {
    select: chatOfferSelect,
    orderBy: { createdAt: "desc" as const },
    take: 5,
  },
  messages: {
    select: {
      id: true,
      senderId: true,
      senderName: true,
      text: true,
      imageUrl: true,
      offerId: true,
      isRead: true,
      createdAt: true,
      offer: { select: chatOfferSelect },
    },
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    take: 1,
  },
} satisfies Prisma.ConversationInclude;

/**
 * Lazily marks any past-due PENDING/ACCEPTED offers in the specified conversations as EXPIRED.
 */
export async function syncExpiredOffers(
  conversationIds: string[]
): Promise<void> {
  if (conversationIds.length === 0) return;
  await prisma.priceOffer.updateMany({
    where: {
      conversationId: { in: conversationIds },
      status: { in: ["PENDING", "ACCEPTED"] },
      expiresAt: { lt: new Date() },
    },
    data: {
      status: "EXPIRED",
    },
  });
}

async function assertParticipantAccess(
  viewerId: string,
  conversationId: string
) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      listingId: true,
      buyerId: true,
      sellerId: true,
      listing: {
        select: {
          price: true,
          status: true,
        },
      },
    },
  });

  if (!convo) {
    throw new ChatDomainError(
      404,
      "CONVERSATION_NOT_FOUND",
      "Percakapan Tidak Ditemukan",
      "Percakapan tidak ditemukan."
    );
  }

  if (convo.buyerId !== viewerId && convo.sellerId !== viewerId) {
    throw new ChatDomainError(
      403,
      "FORBIDDEN",
      "Akses Ditolak",
      "Anda bukan peserta dalam percakapan ini."
    );
  }

  return convo;
}

export async function createOrGetConversation(
  viewer: ChatViewer,
  rawBody: unknown
) {
  const parsed = CreateConversationSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ChatDomainError(
      400,
      "VALIDATION_ERROR",
      "Permintaan Tidak Valid",
      parsed.error.issues[0]?.message || "Data percakapan tidak valid."
    );
  }

  const { listingId } = parsed.data;
  const listing = await prisma.productListing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, status: true, title: true },
  });

  if (!listing) {
    throw new ChatDomainError(
      404,
      "LISTING_NOT_FOUND",
      "Iklan Tidak Ditemukan",
      "Barang yang ingin didiskusikan tidak ditemukan."
    );
  }

  if (listing.sellerId === viewer.id) {
    throw new ChatDomainError(
      403,
      "CANNOT_CHAT_OWN_LISTING",
      "Tidak Diizinkan",
      "Penjual tidak dapat membuka ruang obrolan pada iklan milik sendiri."
    );
  }

  const existing = await prisma.conversation.findUnique({
    where: {
      buyerId_listingId: {
        buyerId: viewer.id,
        listingId: listing.id,
      },
    },
  });

  if (existing) {
    await syncExpiredOffers([existing.id]);
    const hydrated = await prisma.conversation.findUniqueOrThrow({
      where: { id: existing.id },
      include: conversationInclude,
    });
    const unread = await prisma.chatMessage.count({
      where: {
        conversationId: existing.id,
        senderId: { not: viewer.id },
        isRead: false,
      },
    });
    return {
      conversation: mapConversationToDto(hydrated, viewer.id, unread),
      created: false,
    };
  }

  if (listing.status !== LISTING_STATUS.ACTIVE) {
    throw new ChatDomainError(
      422,
      "LISTING_NOT_ACTIVE",
      "Iklan Tidak Aktif",
      "Iklan ini sudah tidak aktif untuk memulai percakapan baru."
    );
  }

  try {
    const createdRow = await prisma.conversation.create({
      data: {
        id: generateInternalId("conv"),
        listingId: listing.id,
        buyerId: viewer.id,
        sellerId: listing.sellerId,
        lastMessage: `Diskusi tentang ${listing.title}`.slice(0, 140),
        lastTimestamp: new Date(),
      },
      include: conversationInclude,
    });

    return {
      conversation: mapConversationToDto(createdRow, viewer.id, 0),
      created: true,
    };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const winner = await prisma.conversation.findUniqueOrThrow({
        where: {
          buyerId_listingId: {
            buyerId: viewer.id,
            listingId: listing.id,
          },
        },
        include: conversationInclude,
      });
      return {
        conversation: mapConversationToDto(winner, viewer.id, 0),
        created: false,
      };
    }
    throw err;
  }
}

export async function listConversations(viewer: ChatViewer, rawQuery: unknown) {
  const parsed = ListConversationsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new ChatDomainError(
      400,
      "VALIDATION_ERROR",
      "Parameter Query Tidak Valid",
      parsed.error.issues[0]?.message || "Parameter daftar obrolan tidak valid."
    );
  }

  const { limit, cursor: rawCursor } = parsed.data;
  const decodedCursor = rawCursor ? decodeTimeIdCursor(rawCursor) : null;
  if (rawCursor && !decodedCursor) {
    throw new ChatDomainError(
      400,
      "INVALID_CURSOR",
      "Cursor Tidak Valid",
      "Parameter cursor daftar obrolan tidak valid."
    );
  }

  const participantFilter: Prisma.ConversationWhereInput = {
    OR: [{ buyerId: viewer.id }, { sellerId: viewer.id }],
  };

  const whereClause: Prisma.ConversationWhereInput = decodedCursor
    ? {
        AND: [
          participantFilter,
          {
            OR: [
              { lastTimestamp: { lt: decodedCursor.t } },
              {
                lastTimestamp: decodedCursor.t,
                id: { lt: decodedCursor.id },
              },
            ],
          },
        ],
      }
    : participantFilter;

  const rows = await prisma.conversation.findMany({
    where: whereClause,
    include: conversationSummaryInclude,
    orderBy: [{ lastTimestamp: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const convoIds = slice.map((c) => c.id);

  await syncExpiredOffers(convoIds);

  const unreadGroups =
    convoIds.length > 0
      ? await prisma.chatMessage.groupBy({
          by: ["conversationId"],
          where: {
            conversationId: { in: convoIds },
            senderId: { not: viewer.id },
            isRead: false,
          },
          _count: { _all: true },
        })
      : [];

  const unreadByConvo = new Map<string, number>();
  for (const grp of unreadGroups) {
    unreadByConvo.set(grp.conversationId, grp._count._all);
  }

  const totalUnreadCount = await prisma.chatMessage.count({
    where: {
      conversation: participantFilter,
      senderId: { not: viewer.id },
      isRead: false,
    },
  });

  const lastItem = slice[slice.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? encodeTimeIdCursor(lastItem.lastTimestamp, lastItem.id)
      : null;

  return {
    object: "list" as const,
    data: slice.map((row) =>
      mapConversationToDto(
        {
          ...row,
          messages: [...row.messages].reverse(),
        },
        viewer.id,
        unreadByConvo.get(row.id) ?? 0
      )
    ),
    unreadTotal: totalUnreadCount,
    pagination: {
      limit,
      hasMore,
      nextCursor,
    },
  };
}

export async function getConversationDetail(
  viewer: ChatViewer,
  conversationId: string
) {
  await assertParticipantAccess(viewer.id, conversationId);
  await syncExpiredOffers([conversationId]);

  await prisma.chatMessage.updateMany({
    where: {
      conversationId,
      senderId: { not: viewer.id },
      isRead: false,
    },
    data: { isRead: true },
  });

  const convo = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: conversationInclude,
  });

  return mapConversationToDto(convo, viewer.id, 0);
}

export async function pollConversationMessages(
  viewer: ChatViewer,
  conversationId: string,
  rawQuery: unknown
) {
  const access = await assertParticipantAccess(viewer.id, conversationId);

  const parsed = ListMessagesQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new ChatDomainError(
      400,
      "VALIDATION_ERROR",
      "Parameter Query Tidak Valid",
      parsed.error.issues[0]?.message || "Parameter pesan tidak valid."
    );
  }

  await syncExpiredOffers([conversationId]);

  const { after, limit } = parsed.data;
  let afterCursor = after ? decodeTimeIdCursor(after) : null;

  if (after && !afterCursor) {
    const anchorMsg = await prisma.chatMessage.findFirst({
      where: { id: after, conversationId },
      select: { id: true, createdAt: true },
    });
    if (!anchorMsg) {
      throw new ChatDomainError(
        400,
        "INVALID_CURSOR",
        "Cursor Tidak Valid",
        "Parameter after cursor tidak valid untuk percakapan ini."
      );
    }
    afterCursor = { t: anchorMsg.createdAt, id: anchorMsg.id };
  }

  const whereClause: Prisma.ChatMessageWhereInput = afterCursor
    ? {
        conversationId,
        OR: [
          { createdAt: { gt: afterCursor.t } },
          {
            createdAt: afterCursor.t,
            id: { gt: afterCursor.id },
          },
        ],
      }
    : { conversationId };

  const messages = await prisma.chatMessage.findMany({
    where: whereClause,
    select: {
      id: true,
      senderId: true,
      senderName: true,
      text: true,
      imageUrl: true,
      offerId: true,
      isRead: true,
      createdAt: true,
      offer: { select: chatOfferSelect },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
  });

  const incomingIds = messages
    .filter((m) => m.senderId !== viewer.id && !m.isRead)
    .map((m) => m.id);

  if (incomingIds.length > 0) {
    await prisma.chatMessage.updateMany({
      where: { id: { in: incomingIds } },
      data: { isRead: true },
    });
  }

  const [offers, latestListing] = await Promise.all([
    prisma.priceOffer.findMany({
      where: { conversationId },
      select: chatOfferSelect,
      orderBy: { createdAt: "desc" },
    }),
    prisma.productListing.findUnique({
      where: { id: access.listingId },
      select: { status: true, price: true },
    }),
  ]);

  const meta = {
    listingId: access.listingId,
    buyerId: access.buyerId,
    sellerId: access.sellerId,
    listingPrice: latestListing?.price ?? access.listing.price,
  };

  const lastMessage = messages[messages.length - 1];
  const nextCursor = lastMessage
    ? encodeTimeIdCursor(lastMessage.createdAt, lastMessage.id)
    : after ?? null;

  return {
    object: "list" as const,
    data: messages.map((m) =>
      mapMessageToDto(
        {
          ...m,
          isRead: m.senderId !== viewer.id ? true : m.isRead,
        },
        meta
      )
    ),
    offers: offers.map((o) => mapOfferToDto(o, meta)),
    listingStatus: latestListing?.status ?? access.listing.status,
    nextCursor,
  };
}

export async function sendMessage(
  viewer: ChatViewer,
  conversationId: string,
  rawBody: unknown
) {
  await assertParticipantAccess(viewer.id, conversationId);

  const parsed = SendMessageSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ChatDomainError(
      400,
      "VALIDATION_ERROR",
      "Pesan Tidak Valid",
      parsed.error.issues[0]?.message ||
        "Pesan wajib diisi (maksimal 1.000 karakter) dan tanpa field tambahan."
    );
  }

  const text = parsed.data.text;

  return prisma.$transaction(async (tx) => {
    const convo = await tx.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        listingId: true,
        buyerId: true,
        sellerId: true,
        listing: { select: { price: true } },
      },
    });

    if (!convo) {
      throw new ChatDomainError(
        404,
        "CONVERSATION_NOT_FOUND",
        "Percakapan Tidak Ditemukan",
        "Percakapan tidak ditemukan."
      );
    }

    if (convo.buyerId !== viewer.id && convo.sellerId !== viewer.id) {
      throw new ChatDomainError(
        403,
        "FORBIDDEN",
        "Akses Ditolak",
        "Anda bukan peserta dalam percakapan ini."
      );
    }

    // Serialize per-user message rate window in PostgreSQL (30 msgs / 60s)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`chat_rate_${viewer.id}`}))`;

    const windowStart = new Date(Date.now() - 60_000);
    const recentCount = await tx.chatMessage.count({
      where: {
        senderId: viewer.id,
        createdAt: { gte: windowStart },
      },
    });

    if (recentCount >= 30) {
      throw new ChatDomainError(
        429,
        "RATE_LIMITED",
        "Terlalu Banyak Pesan",
        "Batas pengiriman 30 pesan per menit tercapai. Silakan coba lagi beberapa saat."
      );
    }

    const message = await tx.chatMessage.create({
      data: {
        id: generateInternalId("msg"),
        conversationId: convo.id,
        senderId: viewer.id,
        senderName: viewer.name,
        text,
        isRead: false,
      },
      select: {
        id: true,
        senderId: true,
        senderName: true,
        text: true,
        imageUrl: true,
        offerId: true,
        isRead: true,
        createdAt: true,
        offer: { select: chatOfferSelect },
      },
    });

    await tx.conversation.update({
      where: { id: convo.id },
      data: {
        lastMessage: text.slice(0, 140),
        lastTimestamp: message.createdAt,
      },
    });

    return {
      message: mapMessageToDto(message, {
        listingId: convo.listingId,
        buyerId: convo.buyerId,
        sellerId: convo.sellerId,
        listingPrice: convo.listing.price,
      }),
      cursor: encodeTimeIdCursor(message.createdAt, message.id),
    };
  });
}
