import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db/prisma";
import bcrypt from "bcryptjs";
import { DisputeService, DisputeDomainError } from "@/domain/dispute/DisputeService";

describe("Dispute Resolution Integration Test", () => {
  let buyerId: string;
  let sellerId: string;
  let adminId: string;
  let orderId: string;
  let escrowId: string;

  beforeEach(async () => {
    const ts = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const hashed = await bcrypt.hash("Password123!", 10);

    const buyer = await prisma.user.create({
      data: {
        email: `dsp-buyer-${ts}@test.id`,
        name: "Dispute Buyer",
        role: "BUYER",
        hashedPassword: hashed,
      },
    });
    buyerId = buyer.id;

    const seller = await prisma.user.create({
      data: {
        email: `dsp-seller-${ts}@test.id`,
        name: "Dispute Seller",
        role: "SELLER",
        hashedPassword: hashed,
        wallet: {
          create: {
            activeBalance: 0,
            heldBalance: 9800000,
          },
        },
      },
    });
    sellerId = seller.id;

    const admin = await prisma.user.create({
      data: {
        email: `dsp-admin-${ts}@test.id`,
        name: "Dispute Admin",
        role: "ADMIN",
        hashedPassword: hashed,
      },
    });
    adminId = admin.id;

    const listing = await prisma.productListing.create({
      data: {
        slug: `dsp-iphone-${ts}`,
        title: "iPhone 13 Pro 128GB",
        description: "Mulus no minus",
        price: 9800000,
        category: "smartphone",
        categoryLabel: "Smartphone",
        brand: "Apple",
        model: "iPhone 13 Pro",
        condition: "LIKE_NEW",
        sellerId: seller.id,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-DSP-${ts}`,
        buyerId: buyer.id,
        sellerId: seller.id,
        listingId: listing.id,
        itemPrice: 9800000,
        shippingFee: 30000,
        totalAmount: 9830000,
        status: "INSPECTING",
        shippingAddress: "Jl. Merdeka No. 45 Jakarta",
        inspectionExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        escrowAccount: {
          create: {
            amount: 9830000,
            status: "HELD",
            idempotencyKey: `ESC-DEP-${ts}`,
          },
        },
      },
      include: { escrowAccount: true },
    });
    orderId = order.id;
    escrowId = order.escrowAccount!.id;
  });

  it("buyer opens dispute -> freezes escrow account and transitions order to DISPUTED", async () => {
    const dispute = await DisputeService.openDispute({
      orderId,
      buyerId,
      reason: "DAMAGED_IN_TRANSIT",
      description: "Layar retak saat unboxing pertama kali",
      evidences: [
        {
          fileUrl: "https://example.com/evidence-unboxing.jpg",
          fileType: "image/jpeg",
          fileSize: 204800,
          description: "Foto retak layar",
        },
      ],
    });

    expect(dispute.disputeNumber).toContain("DSP-");
    expect(dispute.status).toBe("OPEN");

    // Verify order status is DISPUTED
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { escrowAccount: true },
    });
    expect(order?.status).toBe("DISPUTED");
    expect(order?.escrowAccount?.status).toBe("FROZEN_DISPUTE");
  });

  it("admin resolves dispute with REFUND_BUYER verdict -> executes refund and marks dispute RESOLVED_BUYER", async () => {
    // 1. Open dispute
    const dispute = await DisputeService.openDispute({
      orderId,
      buyerId,
      reason: "NOT_AS_DESCRIBED",
      description: "Spesifikasi tidak cocok",
    });

    // 2. Admin resolves with REFUND_BUYER
    const verdictRes = await DisputeService.resolveDispute({
      disputeId: dispute.id,
      adminId,
      verdict: "REFUND_BUYER",
      adminNotes: "Bukti unboxing membuktikan unit berbeda serial number. Refund 100% disetujui.",
    });

    expect(verdictRes.success).toBe(true);
    expect(verdictRes.status).toBe("RESOLVED_BUYER");

    // Verify escrow refunded in DB
    const escrow = await prisma.escrowAccount.findUnique({ where: { id: escrowId } });
    expect(escrow?.isRefunded).toBe(true);
    expect(escrow?.status).toBe("REFUNDED");

    // Verify order status is REFUNDED
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("REFUNDED");

    // Verify seller held balance cleared
    const sellerWallet = await prisma.wallet.findUnique({ where: { userId: sellerId } });
    expect(sellerWallet?.heldBalance).toBe(0);

    // Verify cannot resolve dispute again (idempotent / terminal)
    await expect(
      DisputeService.resolveDispute({
        disputeId: dispute.id,
        adminId,
        verdict: "RELEASE_SELLER",
        adminNotes: "Try reversing verdict",
      })
    ).rejects.toThrow(DisputeDomainError);
  });

  it("admin resolves dispute with RELEASE_SELLER verdict -> unfreezes and releases funds to seller wallet", async () => {
    const dispute = await DisputeService.openDispute({
      orderId,
      buyerId,
      reason: "FAKE_ITEM",
      description: "Klaim palsu tanpa bukti",
    });

    const verdictRes = await DisputeService.resolveDispute({
      disputeId: dispute.id,
      adminId,
      verdict: "RELEASE_SELLER",
      adminNotes: "Klaim pembeli tidak terbukti, unit original iBox terverifikasi. Dana diteruskan ke penjual.",
    });

    expect(verdictRes.success).toBe(true);
    expect(verdictRes.status).toBe("RESOLVED_SELLER");

    // Verify escrow released
    const escrow = await prisma.escrowAccount.findUnique({ where: { id: escrowId } });
    expect(escrow?.isReleased).toBe(true);
    expect(escrow?.status).toBe("RELEASED");

    // Verify seller wallet credited
    const sellerWallet = await prisma.wallet.findUnique({ where: { userId: sellerId } });
    expect(sellerWallet?.activeBalance).toBe(9800000);
    expect(sellerWallet?.heldBalance).toBe(0);

    // Verify order completed
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("COMPLETED");
  });
});
