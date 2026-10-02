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

  describe("Task 4.1 — Distinguish 'no PIN' from 'wrong PIN'", () => {
    it("returns PIN_NOT_SET without consuming failed attempts when hashedPin is null", async () => {
      // Create user with null hashedPin
      const noPinUser = await prisma.user.create({
        data: {
          email: `no-pin-${Date.now()}@test.id`,
          name: "No PIN User",
          role: "SELLER",
          hashedPassword: await bcrypt.hash("Password123!", 10),
          hashedPin: null,
          wallet: {
            create: {
              activeBalance: 5000000,
              heldBalance: 0,
            },
          },
        },
      });

      // 1. verifyPin returns machine-readable reason PIN_NOT_SET
      const check = await WalletLedgerService.verifyPin(noPinUser.id, "123456");
      expect(check.valid).toBe(false);
      expect(check.reason).toBe("PIN_NOT_SET");

      // Verify pinFailedAttempts is untouched
      const dbUser1 = await prisma.user.findUnique({ where: { id: noPinUser.id } });
      expect(dbUser1?.pinFailedAttempts).toBe(0);

      // 2. requestWithdrawal throws PIN_NOT_SET
      await expect(
        WalletLedgerService.requestWithdrawal({
          userId: noPinUser.id,
          amount: 50000,
          bankName: "BCA",
          accountNumber: "1234567890",
          accountHolder: "No PIN User",
          pin: "123456",
        })
      ).rejects.toThrowError(
        expect.objectContaining({
          name: "WalletDomainError",
          code: "PIN_NOT_SET",
        })
      );

      // Verify pinFailedAttempts remains 0 after withdrawal attempt
      const dbUser2 = await prisma.user.findUnique({ where: { id: noPinUser.id } });
      expect(dbUser2?.pinFailedAttempts).toBe(0);
    });

    it("throws INVALID_PIN and increments counter when PIN is wrong", async () => {
      const wrongPinUser = await prisma.user.create({
        data: {
          email: `wrong-pin-${Date.now()}@test.id`,
          name: "Wrong PIN User",
          role: "SELLER",
          hashedPassword: await bcrypt.hash("Password123!", 10),
          hashedPin: await bcrypt.hash("654321", 10),
          wallet: {
            create: {
              activeBalance: 5000000,
              heldBalance: 0,
            },
          },
        },
      });

      await expect(
        WalletLedgerService.requestWithdrawal({
          userId: wrongPinUser.id,
          amount: 50000,
          bankName: "BCA",
          accountNumber: "1234567890",
          accountHolder: "Wrong PIN User",
          pin: "111222",
        })
      ).rejects.toThrowError(
        expect.objectContaining({
          name: "WalletDomainError",
          code: "INVALID_PIN",
        })
      );

      const dbUser = await prisma.user.findUnique({ where: { id: wrongPinUser.id } });
      expect(dbUser?.pinFailedAttempts).toBe(1);
    });
  });
});
