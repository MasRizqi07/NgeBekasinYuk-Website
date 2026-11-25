// NgeBekasinYuk Zod Input Validation Schemas
// Enforces strict types, lengths, and constraints at API boundaries.

import { z } from "zod";
import {
  LISTING_CATEGORY_SLUGS,
  LISTING_CONDITION_VALUES,
} from "@/domain/listing/listingMetadata";

export const LoginSchema = z.object({
  email: z.string().email("Format email tidak valid").toLowerCase().trim(),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export const RegisterSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(100).trim(),
  email: z.string().email("Format email tidak valid").toLowerCase().trim(),
  password: z.string().min(8, "Password minimal 8 karakter"),
  phone: z.string().regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/, "Format nomor HP tidak valid").optional().or(z.literal("")),
  role: z.enum(["BUYER", "SELLER"]).default("BUYER"),
});

export const OrderTransitionSchema = z.object({
  toStatus: z.enum([
    "FUNDED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "INSPECTING",
    "COMPLETED",
    "DISPUTED",
    "CANCELLED",
  ]),
  shippingCourier: z.string().max(50).optional(),
  shippingAirwayBill: z.string().max(50).optional(),
  reason: z.string().max(500).optional(),
});

export const CreateOrderSchema = z
  .object({
    listingId: z.string().min(1, "Listing ID wajib diisi"),
    shippingAddress: z.string().min(5, "Alamat pengiriman minimal 5 karakter").max(500),
    courier: z.string().min(1, "Kurir pengiriman wajib dipilih").max(100),
    paymentMethod: z.enum(["BCA_VA", "MANDIRI_VA", "BRI_VA", "BNI_VA", "QRIS"]),
    offerId: z.string().optional(),
  })
  .strict();

export const WithdrawalRequestSchema = z.object({
  amount: z.number().int().positive().min(10000, "Minimal penarikan Rp 10.000"),
  bankAccountId: z.string().min(1, "ID Rekening tujuan penarikan wajib diisi"),
  pin: z.string().regex(/^\d{6}$/, "PIN harus berupa 6 digit angka"),
  clientRequestId: z.string().min(16).max(100).optional(),
  // Legacy fields accepted but ignored in favor of canonical PostgreSQL BankAccount snapshot:
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountHolder: z.string().optional(),
});

export const OpenDisputeSchema = z.object({
  orderId: z.string().min(1, "Order ID wajib diisi"),
  reason: z.enum([
    "NOT_AS_DESCRIBED",
    "DAMAGED_IN_TRANSIT",
    "FAKE_ITEM",
    "MISSING_ACCESSORIES",
    "DEFECTIVE_FUNCTION",
  ]),
  description: z.string().min(10, "Keterangan komplain minimal 10 karakter").max(2000),
  evidences: z
    .array(
      z.object({
        fileUrl: z.string().url("URL bukti tidak valid"),
        fileType: z.string().max(50),
        fileSize: z.number().int().positive().max(50 * 1024 * 1024), // Max 50MB
        description: z.string().max(255).optional(),
      })
    )
    .optional(),
});

export const AdminVerdictSchema = z.object({
  verdict: z.enum(["RELEASE_SELLER", "REFUND_BUYER"]),
  adminNotes: z.string().min(5, "Catatan putusan minimal 5 karakter").max(1000),
  stepUpCode: z.string().min(6, "Kode otorisasi 6 digit atau token grant wajib diisi").max(500),
});

export const WebhookSimulationSchema = z.object({
  paymentAttemptId: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().int().positive(),
});

export const WEAK_PINS = [
  "000000",
  "111111",
  "222222",
  "333333",
  "444444",
  "555555",
  "666666",
  "777777",
  "888888",
  "999999",
  "012345",
  "123456",
  "234567",
  "345678",
  "456789",
  "543210",
  "654321",
  "765432",
  "876543",
  "987654",
  "123123",
  "121212",
  "696969",
  "112233",
] as const;

export function isTriviallyWeakPin(pin: string): boolean {
  if ((WEAK_PINS as readonly string[]).includes(pin)) return true;
  // All identical digits
  if (/^(\d)\1{5}$/.test(pin)) return true;
  // Sequential digits ascending or descending
  const isAscending = "0123456789".includes(pin);
  const isDescending = "9876543210".includes(pin);
  if (isAscending || isDescending) return true;
  return false;
}

export const SetWalletPinSchema = z
  .object({
    password: z.string().min(1, "Password wajib diisi"),
    pin: z.string().regex(/^\d{6}$/, "PIN harus berupa 6 digit angka"),
  })
  .strict();

export const LISTING_SORT_OPTIONS = [
  "newest",
  "price_asc",
  "price_desc",
  "popular",
] as const;

export const SAFE_LISTING_IMAGE_URL_REGEX =
  /^(?:\/api\/listings\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)|\/assets\/products\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp))$/;

export const CreateListingSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Judul minimal 3 karakter")
      .max(160, "Judul maksimal 160 karakter"),
    description: z
      .string()
      .trim()
      .min(10, "Deskripsi minimal 10 karakter")
      .max(5000, "Deskripsi maksimal 5000 karakter"),
    price: z
      .number()
      .int("Harga harus bilangan bulat Rupiah")
      .min(10000, "Harga minimal Rp 10.000")
      .max(500000000, "Harga maksimal Rp 500.000.000"),
    originalPrice: z
      .number()
      .int("Harga coret harus bilangan bulat")
      .min(10000)
      .max(1000000000)
      .nullable()
      .optional(),
    category: z.enum(LISTING_CATEGORY_SLUGS, {
      message: "Kategori tidak valid",
    }),
    brand: z.string().trim().min(1, "Merek wajib diisi").max(80),
    model: z.string().trim().min(1, "Model wajib diisi").max(120),
    condition: z.enum(LISTING_CONDITION_VALUES, {
      message: "Kondisi barang tidak valid",
    }),
    canNego: z.boolean().default(true),
    minNegoPrice: z
      .number()
      .int("Harga minimum nego harus bilangan bulat")
      .min(10000)
      .max(500000000)
      .nullable()
      .optional(),
    images: z
      .array(
        z
          .string()
          .regex(SAFE_LISTING_IMAGE_URL_REGEX, "URL gambar tidak diizinkan")
      )
      .max(8, "Maksimal 8 foto per iklan")
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.originalPrice != null && data.originalPrice < data.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["originalPrice"],
        message: "Harga coret harus >= harga jual.",
      });
    }
    if (data.minNegoPrice != null && data.minNegoPrice > data.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minNegoPrice"],
        message: "Harga minimum nego tidak boleh melebihi harga jual.",
      });
    }
  });

export const UpdateListingSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    price: z.number().int().min(10000).max(500000000).optional(),
    originalPrice: z.number().int().min(10000).max(1000000000).nullable().optional(),
    category: z.enum(LISTING_CATEGORY_SLUGS).optional(),
    brand: z.string().trim().min(1).max(80).optional(),
    model: z.string().trim().min(1).max(120).optional(),
    condition: z.enum(LISTING_CONDITION_VALUES).optional(),
    canNego: z.boolean().optional(),
    minNegoPrice: z.number().int().min(10000).max(500000000).nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimal satu atribut iklan harus diubah.",
      });
    }
    if (
      data.price !== undefined &&
      data.originalPrice != null &&
      data.originalPrice < data.price
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["originalPrice"],
        message: "Harga coret harus >= harga jual.",
      });
    }
    if (
      data.price !== undefined &&
      data.minNegoPrice != null &&
      data.minNegoPrice > data.price
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minNegoPrice"],
        message: "Harga minimum nego tidak boleh melebihi harga jual.",
      });
    }
  });

export const ListListingsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(40).optional(),
  condition: z.string().trim().max(200).optional(),
  brand: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().int().min(0).max(1000000000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(1000000000).optional(),
  sellerId: z.string().trim().max(100).optional(),
  status: z.enum(["ACTIVE", "RESERVED", "SOLD", "ARCHIVED"]).optional(),
  mine: z.enum(["true", "false", "1", "0"]).optional(),
  canNego: z.enum(["true", "false", "1", "0"]).optional(),
  verifiedOnly: z.enum(["true", "false", "1", "0"]).optional(),
  city: z.string().trim().max(80).optional(),
  ids: z.string().trim().max(2500).optional(),
  sort: z.enum(LISTING_SORT_OPTIONS).default("newest"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().trim().max(500).optional(),
});


