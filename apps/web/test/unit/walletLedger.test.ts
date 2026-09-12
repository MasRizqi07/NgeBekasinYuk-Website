import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db/prisma";
import { WalletLedgerService, WalletDomainError } from "@/domain/wallet/WalletLedgerService";
import bcrypt from "bcryptjs";

describe("Wallet Ledger & PIN Hardening Unit Tests", () => {
  let userId: string;
  let walletId: string;

  beforeEach(async () => {
    const ts = Date.now().toString().slice(-6);
    const hashedPw = await bcrypt.hash("Password123!", 10);
    const hashedPin = await bcrypt.hash("123456", 10);

    const user = await prisma.user.create({
      data: {
        email: `wallet-user-${ts}@test.id`,
        name: "Wallet Test User",
        role: "SELLER",
        hashedPassword: hashedPw,
        hashedPin: hashedPin,
        wallet: {
          create: {
            activeBalance: 15000000,
            heldBalance: 2000000,
          },
        },
      },
      include: { wallet: true },
    });

    userId = user.id;
    walletId = user.wallet!.id;
  });

  describe("P0-04 PIN Hardening & Rate-Limiting", () => {
    it("accepts the correct 6-digit PIN", async () => {
      const res = await WalletLedgerService.verifyPin(userId, "123456");
      expect(res.valid).toBe(true);
      expect(res.locked).toBe(false);
    });

    it("rejects an incorrect 6-digit PIN (fixes the original P0-04 bug)", async () => {
      // Previously, '999999' was accepted because pin.length === 6 was true and condition was negated!
      const res = await WalletLedgerService.verifyPin(userId, "999999");
      expect(res.valid).toBe(false);
      expect(res.locked).toBe(false);
      expect(res.remainingAttempts).toBe(4);
    });

    it("rejects non-6-digit PIN format", async () => {
      const resShort = await WalletLedgerService.verifyPin(userId, "12345");
      expect(resShort.valid).toBe(false);

      const resAlpha = await WalletLedgerService.verifyPin(userId, "abcdef");
      expect(resAlpha.valid).toBe(false);
    });

    it("locks user PIN after 5 consecutive failed attempts", async () => {
      // Attempt 1 to 4: count decrements
      for (let i = 1; i <= 4; i++) {
        const res = await WalletLedgerService.verifyPin(userId, "000000");
        expect(res.valid).toBe(false);
        expect(res.locked).toBe(false);
        expect(res.remainingAttempts).toBe(5 - i);
      }

      // 5th failed attempt: triggers lockout
      const fifthRes = await WalletLedgerService.verifyPin(userId, "000000");
      expect(fifthRes.valid).toBe(false);
      expect(fifthRes.locked).toBe(true);
      expect(fifthRes.message).toContain("terkunci");

      // Verify locked status persists in DB
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.pinFailedAttempts).toBe(5);
      expect(user?.pinLockedUntil).toBeDefined();

      // Even correct PIN is rejected while account is locked
      const blockedRes = await WalletLedgerService.verifyPin(userId, "123456");
      expect(blockedRes.valid).toBe(false);
      expect(blockedRes.locked).toBe(true);
    });
  });

  describe("Withdrawal Workflows & Invariants", () => {
    it("successfully creates withdrawal and deducts active balance with valid PIN", async () => {
      const res = await WalletLedgerService.requestWithdrawal({
        userId,
        amount: 5000000,
        bankName: "BCA",
        accountNumber: "8271019281",
        accountHolder: "Wallet Test User",
        pin: "123456",
      });

      expect(res.success).toBe(true);
      expect(res.newActiveBalance).toBe(10000000);
      expect(res.isSimulation).toBe(true); // Honest labeling

      // Verify wallet balance in DB
      const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(wallet?.activeBalance).toBe(10000000);

      // Verify immutable wallet ledger entry
      const ledgers = await prisma.walletLedgerEntry.findMany({ where: { walletId } });
      expect(ledgers.some((l) => l.type === "WITHDRAWAL" && l.direction === "DEBIT")).toBe(true);
    });

    it("rejects withdrawal with insufficient active balance", async () => {
      await expect(
        WalletLedgerService.requestWithdrawal({
          userId,
          amount: 25000000, // Balance is only 15000000
          bankName: "BCA",
          accountNumber: "8271019281",
          accountHolder: "Wallet Test User",
          pin: "123456",
        })
      ).rejects.toThrow(WalletDomainError);
    });

    it("rejects withdrawal with invalid PIN", async () => {
      await expect(
        WalletLedgerService.requestWithdrawal({
          userId,
          amount: 1000000,
          bankName: "BCA",
          accountNumber: "8271019281",
          accountHolder: "Wallet Test User",
          pin: "999999",
        })
      ).rejects.toThrow(WalletDomainError);
    });

    it("IDEMPOTENCY: duplicate withdrawal request does not double-debit active balance", async () => {
      const key = `IDEMP-WD-${Date.now()}`;

      // First call
      const first = await WalletLedgerService.requestWithdrawal({
        userId,
        amount: 2000000,
        bankName: "BCA",
        accountNumber: "8271019281",
        accountHolder: "Wallet Test User",
        pin: "123456",
        customIdempotencyKey: key,
      });
      expect(first.isDuplicate).toBe(false);
      expect(first.newActiveBalance).toBe(13000000);

      // Second call with same idempotency key
      const second = await WalletLedgerService.requestWithdrawal({
        userId,
        amount: 2000000,
        bankName: "BCA",
        accountNumber: "8271019281",
        accountHolder: "Wallet Test User",
        pin: "123456",
        customIdempotencyKey: key,
      });
      expect(second.isDuplicate).toBe(true);

      // Verify wallet was deducted only once
      const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(wallet?.activeBalance).toBe(13000000);
    });
  });
});
