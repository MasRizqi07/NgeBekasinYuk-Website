// Financial Concurrency & Race Condition Verification on PostgreSQL (HP2-P0-04, HP2-P0-05)
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db/prisma";
import { EscrowLedgerService } from "@/domain/escrow/EscrowLedgerService";
import { WalletLedgerService } from "@/domain/wallet/WalletLedgerService";
import { DisputeService } from "@/domain/dispute/DisputeService";
import { encryptSensitiveSecret } from "../../src/lib/security/encryption";
import bcrypt from "bcryptjs";

describe("Financial Concurrency & Mutation Atomicity Tests (PostgreSQL)", () => {
  let buyerId: string;
  let sellerId: string;
  let adminId: string;
  const pin = "123456";

  beforeEach(async () => {
    const hashedPw = await bcrypt.hash("Password123!", 10);
    const hashedPin = await bcrypt.hash(pin, 10);

    // Create unique users for isolated concurrency test execution
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    const buyer = await prisma.user.create({
      data: {
        email: `buyer-conc-${randomSuffix}@test.id`,
        name: "Concurrency Buyer",
        role: "BUYER",
        hashedPassword: hashedPw,
        hashedPin,
      },
    });
    buyerId = buyer.id;

    const seller = await prisma.user.create({
      data: {
        email: `seller-conc-${randomSuffix}@test.id`,
        name: "Concurrency Seller",
        role: "SELLER",
        hashedPassword: hashedPw,
        hashedPin,
        wallet: {
          create: {
            activeBalance: 0,
            heldBalance: 0,
          },
        },
      },
    });
    sellerId = seller.id;

    const encryptedTotp = encryptSensitiveSecret("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP");
    const admin = await prisma.user.create({
      data: {
        email: `admin-conc-${randomSuffix}@test.id`,
        name: "Concurrency Admin",
        role: "ADMIN",
        hashedPassword: hashedPw,
        hashedPin,
        isTotpEnrolled: true,
        totpSecretCiphertext: encryptedTotp.ciphertext,
        totpSecretIv: encryptedTotp.iv,
        totpSecretTag: encryptedTotp.tag,
        totpSecretKeyVersion: encryptedTotp.keyVersion,
      },
    });
    adminId = admin.id;
  });

  async function createTestOrderWithEscrow(price = 500_000) {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const listing = await prisma.productListing.create({
      data: {
        slug: `listing-conc-${randomSuffix}`,
        title: "Concurrency Test Listing",
        description: "Listing for concurrency testing",
        price,
        category: "smartphone",
        categoryLabel: "Smartphone",
        brand: "TestBrand",
        model: "TestModel",
        condition: "LIKE_NEW",
        sellerId,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-CONC-${randomSuffix.toUpperCase()}`,
        buyerId,
        sellerId,
        listingId: listing.id,
        itemPrice: price,
        shippingFee: 20_000,
        escrowFee: 0,
        totalAmount: price + 20_000,
        status: "INSPECTING",
        shippingAddress: "Jl. Test Concurrency No. 1",
        escrowAccount: {
          create: {
            amount: price + 20_000,
            status: "HELD",
            idempotencyKey: `ESC-CONC-${randomSuffix}`,
          },
        },
      },
      include: { escrowAccount: true },
    });

    return order;
  }

  it("PARALLEL ESCROW RELEASE: Two simultaneous releases credit the seller wallet exactly once", async () => {
    const order = await createTestOrderWithEscrow(600_000);

    // Trigger two parallel escrow releases simultaneously
    const [res1, res2] = await Promise.allSettled([
      EscrowLedgerService.releaseEscrow({
        orderId: order.id,
        actorId: buyerId,
        actorRole: "BUYER",
        customIdempotencyKey: `REL-A-${order.id}`,
      }),
      EscrowLedgerService.releaseEscrow({
        orderId: order.id,
        actorId: buyerId,
        actorRole: "BUYER",
        customIdempotencyKey: `REL-B-${order.id}`,
      }),
    ]);

    // Verify outcomes: exactly one must successfully perform the release, other must fail with ESCROW_ALREADY_RELEASED
    const fulfilled = [res1, res2].filter((r) => r.status === "fulfilled");
    const rejected = [res1, res2].filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Verify wallet active balance matches exactly one credit of itemPrice (600,000 IDR)
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: sellerId },
    });
    expect(wallet.activeBalance).toBe(600_000);

    // Verify escrow state
    const escrow = await prisma.escrowAccount.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    expect(escrow.isReleased).toBe(true);
    expect(escrow.isRefunded).toBe(false);
  });

  it("RELEASE VS REFUND RACE: Mutual exclusion guaranteed when release and refund collide", async () => {
    const order = await createTestOrderWithEscrow(750_000);

    // Collide simultaneous release and refund
    const [releaseResult, refundResult] = await Promise.allSettled([
      EscrowLedgerService.releaseEscrow({
        orderId: order.id,
        actorId: buyerId,
        actorRole: "BUYER",
        customIdempotencyKey: `RACE-REL-${order.id}`,
      }),
      EscrowLedgerService.refundEscrow({
        orderId: order.id,
        actorId: adminId,
        actorRole: "ADMIN",
        reason: "Dispute decided in favor of buyer",
        customIdempotencyKey: `RACE-REF-${order.id}`,
      }),
    ]);

    // Invariant: Exactly one must succeed and one must fail
    const fulfilled = [releaseResult, refundResult].filter((r) => r.status === "fulfilled");
    const rejected = [releaseResult, refundResult].filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Invariant: Escrow cannot be both released AND refunded
    const escrow = await prisma.escrowAccount.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    expect(escrow.isReleased !== escrow.isRefunded).toBe(true);
  });

  it("PARALLEL WITHDRAWALS: Two simultaneous 800k withdrawals on a 1M balance only allow one deduction", async () => {
    // Set seller wallet active balance to 1,000,000
    await prisma.wallet.update({
      where: { userId: sellerId },
      data: { activeBalance: 1_000_000 },
    });

    const withdrawalAmount = 800_000;

    // Trigger two parallel withdrawals of 800,000 concurrently
    const [w1, w2] = await Promise.allSettled([
      WalletLedgerService.requestWithdrawal({
        userId: sellerId,
        amount: withdrawalAmount,
        bankName: "BCA",
        accountNumber: "1234567890",
        accountHolder: "Seller Test",
        pin,
        customIdempotencyKey: `WDR-REQ-1-${Date.now()}`,
      }),
      WalletLedgerService.requestWithdrawal({
        userId: sellerId,
        amount: withdrawalAmount,
        bankName: "BCA",
        accountNumber: "1234567890",
        accountHolder: "Seller Test",
        pin,
        customIdempotencyKey: `WDR-REQ-2-${Date.now()}`,
      }),
    ]);

    const fulfilled = [w1, w2].filter((r) => r.status === "fulfilled");
    const rejected = [w1, w2].filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Ensure wallet balance is 200,000 (1M - 800k), NEVER negative
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: sellerId },
    });
    expect(wallet.activeBalance).toBe(200_000);
  });

  it("CONFLICTING DISPUTE VERDICTS: Only one admin verdict can commit", async () => {
    const order = await createTestOrderWithEscrow(900_000);

    // Open dispute
    const dispute = await DisputeService.openDispute({
      orderId: order.id,
      buyerId,
      reason: "NOT_AS_DESCRIBED",
      description: "Item differs significantly from listing photos",
    });

    // Admin A attempts REFUND_BUYER while Admin B attempts RELEASE_SELLER concurrently
    const [verdictA, verdictB] = await Promise.allSettled([
      DisputeService.resolveDispute({
        disputeId: dispute.id,
        adminId,
        verdict: "REFUND_BUYER",
        adminNotes: "Approved refund",
        customIdempotencyKey: `VERD-A-${dispute.id}`,
      }),
      DisputeService.resolveDispute({
        disputeId: dispute.id,
        adminId,
        verdict: "RELEASE_SELLER",
        adminNotes: "Approved release",
        customIdempotencyKey: `VERD-B-${dispute.id}`,
      }),
    ]);

    const fulfilled = [verdictA, verdictB].filter((r) => r.status === "fulfilled");
    const rejected = [verdictA, verdictB].filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Final dispute status is terminal
    const finalDispute = await prisma.dispute.findUniqueOrThrow({
      where: { id: dispute.id },
    });
    expect(["RESOLVED_BUYER", "RESOLVED_SELLER"]).toContain(finalDispute.status);
  });
});
