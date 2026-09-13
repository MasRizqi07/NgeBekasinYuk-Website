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
