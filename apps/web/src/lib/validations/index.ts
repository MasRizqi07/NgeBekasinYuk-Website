// NgeBekasinYuk Zod Input Validation Schemas
// Enforces strict types, lengths, and constraints at API boundaries.

import { z } from "zod";

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
  bankName: z.string().min(2).max(50).trim(),
  accountNumber: z.string().min(5).max(30).trim(),
  accountHolder: z.string().min(2).max(100).trim(),
  pin: z.string().regex(/^\d{6}$/, "PIN harus berupa 6 digit angka"),
  clientRequestId: z.string().min(16).max(100),
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

