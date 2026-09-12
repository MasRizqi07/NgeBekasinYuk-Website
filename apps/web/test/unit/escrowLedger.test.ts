import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db/prisma";
import { EscrowLedgerService, EscrowDomainError } from "@/domain/escrow/EscrowLedgerService";
import bcrypt from "bcryptjs";

describe("Escrow Ledger Financial Invariants Unit Tests", () => {
  let buyerId: string;
  let sellerId: string;
  let orderId: string;
  let escrowId: string;

  beforeEach(async () => {
    // Setup clean test entities in SQLite
    const ts = Date.now().toString().slice(-6);
    const hashed = await bcrypt.hash("Password123!", 10);

    const buyer = await prisma.user.create({
      data: {
        email: `buyer-${ts}@test.id`,
        name: "Test Buyer",
        role: "BUYER",
        hashedPassword: hashed,
      },
    });
    buyerId = buyer.id;

    const seller = await prisma.user.create({
      data: {
        email: `seller-${ts}@test.id`,
        name: "Test Seller",
        role: "SELLER",
        hashedPassword: hashed,
        wallet: {
          create: {
            activeBalance: 0,
            heldBalance: 5000000,
          },
        },
      },
      include: { wallet: true },
    });
    sellerId = seller.id;

    const listing = await prisma.productListing.create({
      data: {
        slug: `listing-${ts}`,
        title: "Test Gadget Item",
        description: "Test description",
        price: 5000000,
        category: "smartphone",
        categoryLabel: "Smartphone",
        brand: "Apple",
        model: "iPhone",
        condition: "LIKE_NEW",
        sellerId: seller.id,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-TEST-${ts}`,
        buyerId: buyer.id,
        sellerId: seller.id,
        listingId: listing.id,
        itemPrice: 5000000,
        shippingFee: 25000,
        totalAmount: 5025000,
        status: "INSPECTING",
        shippingAddress: "Jl. Test No. 1",
        escrowAccount: {
          create: {
            amount: 5025000,
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

  it("releases escrow funds to seller wallet and records immutable ledger", async () => {
    const res = await EscrowLedgerService.releaseEscrow({
      orderId,
      actorId: buyerId,
      actorRole: "BUYER",
    });

    expect(res.success).toBe(true);
    expect(res.isDuplicate).toBe(false);
    expect(res.releasedAmount).toBe(5000000);
    expect(res.sellerNewBalance).toBe(5000000);

    // Verify database state
    const escrow = await prisma.escrowAccount.findUnique({ where: { id: escrowId } });
    expect(escrow?.isReleased).toBe(true);
    expect(escrow?.status).toBe("RELEASED");

    const wallet = await prisma.wallet.findUnique({ where: { userId: sellerId } });
    expect(wallet?.activeBalance).toBe(5000000);
    expect(wallet?.heldBalance).toBe(0);

    const ledgers = await prisma.escrowLedgerEntry.findMany({ where: { escrowAccountId: escrowId } });
    expect(ledgers.some((l) => l.type === "RELEASE_SELLER")).toBe(true);
  });

  it("P0-03 IDEMPOTENCY: calling release multiple times executes financial payout exactly once", async () => {
    const key = `IDEMP-RELEASE-${Date.now()}`;

    // First call: executes payout
    const firstCall = await EscrowLedgerService.releaseEscrow({
      orderId,
      actorId: buyerId,
      actorRole: "BUYER",
      customIdempotencyKey: key,
    });
    expect(firstCall.isDuplicate).toBe(false);
    expect(firstCall.sellerNewBalance).toBe(5000000);

    // Second call with same idempotency key: returns safe duplicate result without double crediting
    const secondCall = await EscrowLedgerService.releaseEscrow({
      orderId,
      actorId: buyerId,
      actorRole: "BUYER",
      customIdempotencyKey: key,
    });
    expect(secondCall.isDuplicate).toBe(true);
    expect(secondCall.sellerNewBalance).toBe(5000000);

    // Verify wallet was credited only ONCE
    const wallet = await prisma.wallet.findUnique({ where: { userId: sellerId } });
    expect(wallet?.activeBalance).toBe(5000000);
  });

  it("MUTUAL EXCLUSION: cannot release escrow if already refunded", async () => {
    // First refund the escrow
    await EscrowLedgerService.refundEscrow({
      orderId,
      actorId: "admin-1",
      actorRole: "ADMIN",
      reason: "Item returned and verified damaged",
    });

    // Attempt release after refund must fail
    await expect(
      EscrowLedgerService.releaseEscrow({
        orderId,
        actorId: buyerId,
        actorRole: "BUYER",
      })
    ).rejects.toThrow(EscrowDomainError);
  });

  it("MUTUAL EXCLUSION: cannot refund escrow if already released", async () => {
    // First release
    await EscrowLedgerService.releaseEscrow({
      orderId,
      actorId: buyerId,
      actorRole: "BUYER",
    });

    // Attempt refund after release must fail
    await expect(
      EscrowLedgerService.refundEscrow({
        orderId,
        actorId: "admin-1",
        actorRole: "ADMIN",
        reason: "Buyer wants refund after completion",
      })
    ).rejects.toThrow(EscrowDomainError);
  });

  it("DISPUTE FREEZE: cannot release funds while in FROZEN_DISPUTE status without override", async () => {
    await prisma.escrowAccount.update({
      where: { id: escrowId },
      data: { status: "FROZEN_DISPUTE" },
    });

    await expect(
      EscrowLedgerService.releaseEscrow({
        orderId,
        actorId: buyerId,
        actorRole: "BUYER",
      })
    ).rejects.toThrow(EscrowDomainError);
  });

  it("FORBIDDEN: seller cannot release their own escrow", async () => {
    await expect(
      EscrowLedgerService.releaseEscrow({
        orderId,
        actorId: sellerId,
        actorRole: "BUYER" as unknown as "ADMIN", // Seller actor ID
      })
    ).rejects.toThrow(EscrowDomainError);
  });
});
