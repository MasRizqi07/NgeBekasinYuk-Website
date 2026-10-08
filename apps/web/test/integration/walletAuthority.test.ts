// Server-Authoritative Wallet Read Model, Payout Destination Integrity & IDOR Defense (Tasks 4B.1, 4B.5, 4B.10, 4B.11)
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { GET as getWallet } from "@/app/api/wallet/route";
import { GET as getWalletPin } from "@/app/api/wallet/pin/route";
import { POST as postWithdraw } from "@/app/api/wallet/withdraw/route";
import bcrypt from "bcryptjs";

let currentSessionUser: {
  id: string;
  email: string;
  name: string;
  role: string;
  isVerified: boolean;
  avatar: string | null;
  accountStatus: string;
  sessionVersion: number;
} | null = null;

vi.mock("@/lib/auth/authoritativeSession", () => ({
  validateAuthoritativeSession: vi.fn(async () => currentSessionUser),
}));

function assertNoSecrets(obj: unknown, path = ""): void {
  const secretPattern = /hash|password|totp|secret|ciphertext|sessionVersion|lastTotp|pinFailedAttempts|pinLockedUntil|\bpin\b|(?:^|_)pin/i;

  if (obj === null || obj === undefined) return;

  if (typeof obj === "object") {
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        assertNoSecrets(item, `${path}[${index}]`);
      });
    } else {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        // Allowable boolean indicator or masked fields
        if (key === "hasPin" || key === "isSimulation") continue;
        if (secretPattern.test(key)) {
          throw new Error(`Secret field exposed at path "${fullPath}": key matches forbidden pattern`);
        }
        // Ensure bank account number is masked, not full
        if (key === "accountNumber") {
          throw new Error(`Unmasked account number exposed at path "${fullPath}"`);
        }
        assertNoSecrets(value, fullPath);
      }
    }
  }
}

describe("Server-Authoritative Wallet Read Model & Payout Destination Security (PostgreSQL)", () => {
  let userA: {
    id: string;
    email: string;
    walletId: string;
    bankAccountId: string;
  };

  let userB: {
    id: string;
    email: string;
    walletId: string;
    bankAccountId: string;
  };

  const defaultPin = "654321";

  beforeEach(async () => {
    const ts = Date.now().toString().slice(-6);
    const hashedPw = await bcrypt.hash("Password123!", 10);
    const hashedPin = await bcrypt.hash(defaultPin, 10);

    // Create User A (Seller)
    const dbUserA = await prisma.user.create({
      data: {
        email: `seller-a-${ts}-${Math.random().toString(36).slice(2, 6)}@test.id`,
        name: "User A Seller",
        role: "SELLER",
        hashedPassword: hashedPw,
        hashedPin,
        wallet: {
          create: {
            activeBalance: 5_000_000,
            heldBalance: 1_200_000,
          },
        },
        bankAccounts: {
          create: {
            bankCode: "BCA",
            bankName: "Bank Central Asia",
            accountNumber: "1234567890",
            accountHolder: "User A Seller",
            isDefault: true,
          },
        },
      },
      include: { wallet: true, bankAccounts: true },
    });

    userA = {
      id: dbUserA.id,
      email: dbUserA.email,
      walletId: dbUserA.wallet!.id,
      bankAccountId: dbUserA.bankAccounts[0].id,
    };

    // Create User B (Another Seller)
    const dbUserB = await prisma.user.create({
      data: {
        email: `seller-b-${ts}-${Math.random().toString(36).slice(2, 6)}@test.id`,
        name: "User B Seller",
        role: "SELLER",
        hashedPassword: hashedPw,
        hashedPin,
        wallet: {
          create: {
            activeBalance: 2_000_000,
            heldBalance: 500_000,
          },
        },
        bankAccounts: {
          create: {
            bankCode: "MANDIRI",
            bankName: "Bank Mandiri",
            accountNumber: "9876543210",
            accountHolder: "User B Seller",
            isDefault: true,
          },
        },
      },
      include: { wallet: true, bankAccounts: true },
    });

    userB = {
      id: dbUserB.id,
      email: dbUserB.email,
      walletId: dbUserB.wallet!.id,
      bankAccountId: dbUserB.bankAccounts[0].id,
    };

    // Add a ledger entry to User A's wallet
    await prisma.walletLedgerEntry.create({
      data: {
        walletId: userA.walletId,
        type: "ESCROW_RELEASE",
        direction: "CREDIT",
        amount: 5_000_000,
        balanceAfter: 5_000_000,
        referenceType: "ORDER",
        referenceId: `ord-test-${ts}`,
        idempotencyKey: `LEDGER-SEED-${ts}`,
        description: "Pelepasan dana pesanan",
      },
    });

    // Add a ledger entry to User B's wallet
    await prisma.walletLedgerEntry.create({
      data: {
        walletId: userB.walletId,
        type: "ESCROW_RELEASE",
        direction: "CREDIT",
        amount: 2_000_000,
        balanceAfter: 2_000_000,
        referenceType: "ORDER",
        referenceId: `ord-test-b-${ts}`,
        idempotencyKey: `LEDGER-SEED-B-${ts}`,
        description: "Pelepasan dana pesanan B",
      },
    });

    currentSessionUser = null;
  });

  // =========================================================================
  // CATEGORY A: Authoritative Wallet Read Model (Task 4B.1, 4B.2, 4B.10, 4B.11)
  // =========================================================================
  describe("A. Authoritative Wallet Read Model (GET /api/wallet)", () => {
    it("1. Returns 401 UNAUTHORIZED when no session exists", async () => {
      currentSessionUser = null;
      const res = await getWallet();
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("UNAUTHORIZED");
    });

    it("2. Returns canonical wallet state, hasPin=true, masked bank accounts, and scoped ledger", async () => {
      currentSessionUser = {
        id: userA.id,
        email: userA.email,
        name: "User A Seller",
        role: "SELLER",
        isVerified: true,
        avatar: null,
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      };

      const res = await getWallet();
      expect(res.status).toBe(200);
      const data = await res.json();

      // 1. Authoritative balances match DB
      expect(data.wallet.activeBalance).toBe(5_000_000);
      expect(data.wallet.heldBalance).toBe(1_200_000);

      // 2. PIN status
      expect(data.security.hasPin).toBe(true);

      // 3. Bank accounts are strictly scoped to User A and masked
      expect(data.bankAccounts.length).toBe(1);
      expect(data.bankAccounts[0].id).toBe(userA.bankAccountId);
      expect(data.bankAccounts[0].bankName).toBe("Bank Central Asia");
      expect(data.bankAccounts[0].accountNumberMasked).toBe("•••• •••• 7890");
      expect(data.bankAccounts[0].accountNumber).toBeUndefined(); // Never expose unmasked in DTO

      // 4. Ledger entries are strictly scoped to User A's wallet
      expect(data.ledgerEntries.length).toBe(1);
      expect(data.ledgerEntries[0].amount).toBe(5_000_000);
      expect(data.ledgerEntries[0].balanceAfter).toBe(5_000_000);
      expect(data.ledgerEntries[0].direction).toBe("CREDIT");
      expect(data.ledgerEntries[0].description).toBe("Pelepasan dana pesanan");

      // 5. Zero secrets or sensitive internal fields in DTO
      assertNoSecrets(data);
    });

    it("3. Correctly reflects hasPin=false when user has no transaction PIN configured", async () => {
      // Create user without PIN
      const ts = Date.now().toString().slice(-6);
      const userNoPin = await prisma.user.create({
        data: {
          email: `nopin-${ts}@test.id`,
          name: "No PIN Seller",
          role: "SELLER",
          hashedPassword: await bcrypt.hash("Password123!", 10),
          hashedPin: null,
          wallet: {
            create: { activeBalance: 0, heldBalance: 0 },
          },
        },
      });

      currentSessionUser = {
        id: userNoPin.id,
        email: userNoPin.email,
        name: "No PIN Seller",
        role: "SELLER",
        isVerified: true,
        avatar: null,
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      };

      const res = await getWallet();
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.security.hasPin).toBe(false);
      assertNoSecrets(data);

      // Compatibility GET /api/wallet/pin also returns hasPin: false
      const pinRes = await getWalletPin();
      expect(pinRes.status).toBe(200);
      const pinData = await pinRes.json();
      expect(pinData.hasPin).toBe(false);
      assertNoSecrets(pinData);
    });
  });

  // =========================================================================
  // CATEGORY B: Payout Destination Integrity & IDOR Defense (Tasks 4B.4 & 4B.5)
  // =========================================================================
  describe("B. Payout Destination Integrity & IDOR Defense (POST /api/wallet/withdraw)", () => {
    it("1. Allows withdrawal to User A's own registered bankAccountId and snapshots canonical details", async () => {
      currentSessionUser = {
        id: userA.id,
        email: userA.email,
        name: "User A Seller",
        role: "SELLER",
        isVerified: true,
        avatar: null,
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      };

      const idempotencyKey = `idemp-auth-${Date.now()}`;
      const req = new Request("http://localhost:3000/api/wallet/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          amount: 1_000_000,
          bankAccountId: userA.bankAccountId,
          pin: defaultPin,
        }),
      });

      const res = await postWithdraw(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.isDuplicate).toBe(false);
      expect(data.amount).toBe(1_000_000);
      expect(data.newActiveBalance).toBe(4_000_000);

      // Verify canonical DB snapshot: bankName, accountNumber, accountHolder are snapshotted from PostgreSQL BankAccount
      const withdrawal = await prisma.withdrawal.findUniqueOrThrow({
        where: { id: data.withdrawalId },
      });
      expect(withdrawal.bankName).toBe("Bank Central Asia");
      expect(withdrawal.accountNumber).toBe("1234567890");
      expect(withdrawal.accountHolder).toBe("User A Seller");

      // Verify DB Ledger: debit entry written with balanceAfter = 4,000,000
      const ledger = await prisma.walletLedgerEntry.findFirstOrThrow({
        where: { referenceId: data.withdrawalId },
      });
      expect(ledger.direction).toBe("DEBIT");
      expect(ledger.amount).toBe(1_000_000);
      expect(ledger.balanceAfter).toBe(4_000_000);

      // Verify no secrets exposed in response
      assertNoSecrets(data);
    });

    it("2. IDOR REJECTION: User A submitting User B's bankAccountId is rejected with generic error and ZERO DB mutations", async () => {
      currentSessionUser = {
        id: userA.id,
        email: userA.email,
        name: "User A Seller",
        role: "SELLER",
        isVerified: true,
        avatar: null,
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      };

      // Record pre-attack state
      const preWalletA = await prisma.wallet.findUniqueOrThrow({ where: { userId: userA.id } });
      const preWalletB = await prisma.wallet.findUniqueOrThrow({ where: { userId: userB.id } });
      const preWithdrawalsA = await prisma.withdrawal.count({ where: { walletId: userA.walletId } });
      const preWithdrawalsB = await prisma.withdrawal.count({ where: { walletId: userB.walletId } });
      const preLedgersA = await prisma.walletLedgerEntry.count({ where: { walletId: userA.walletId } });
      const preLedgersB = await prisma.walletLedgerEntry.count({ where: { walletId: userB.walletId } });

      const req = new Request("http://localhost:3000/api/wallet/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `idor-attack-${Date.now()}`,
        },
        body: JSON.stringify({
          amount: 500_000,
          bankAccountId: userB.bankAccountId, // Foreign account belonging to User B!
          pin: defaultPin,
        }),
      });

      const res = await postWithdraw(req);
      expect(res.status).toBe(404);
      const data = await res.json();

      // Generic safe error message that does not leak whether User B's account exists or details
      expect(data.error).toBe("BANK_ACCOUNT_NOT_FOUND");
      expect(data.message).not.toContain("User B");
      expect(data.message).not.toContain("9876543210");
      expect(data.message).not.toContain("Bank Mandiri");

      // INVARIANT: Zero database mutations
      const postWalletA = await prisma.wallet.findUniqueOrThrow({ where: { userId: userA.id } });
      const postWalletB = await prisma.wallet.findUniqueOrThrow({ where: { userId: userB.id } });
      const postWithdrawalsA = await prisma.withdrawal.count({ where: { walletId: userA.walletId } });
      const postWithdrawalsB = await prisma.withdrawal.count({ where: { walletId: userB.walletId } });
      const postLedgersA = await prisma.walletLedgerEntry.count({ where: { walletId: userA.walletId } });
      const postLedgersB = await prisma.walletLedgerEntry.count({ where: { walletId: userB.walletId } });

      expect(postWalletA.activeBalance).toBe(preWalletA.activeBalance);
      expect(postWalletB.activeBalance).toBe(preWalletB.activeBalance);
      expect(postWithdrawalsA).toBe(preWithdrawalsA);
      expect(postWithdrawalsB).toBe(preWithdrawalsB);
      expect(postLedgersA).toBe(preLedgersA);
      expect(postLedgersB).toBe(preLedgersB);
    });

    it("3. Rejects nonexistent bankAccountId with generic error and zero mutations", async () => {
      currentSessionUser = {
        id: userA.id,
        email: userA.email,
        name: "User A Seller",
        role: "SELLER",
        isVerified: true,
        avatar: null,
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      };

      const preWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: userA.id } });
      const preCount = await prisma.withdrawal.count({ where: { walletId: userA.walletId } });

      const req = new Request("http://localhost:3000/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 100_000,
          bankAccountId: "00000000-0000-0000-0000-000000000000",
          pin: defaultPin,
        }),
      });

      const res = await postWithdraw(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("BANK_ACCOUNT_NOT_FOUND");

      const postWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: userA.id } });
      expect(postWallet.activeBalance).toBe(preWallet.activeBalance);
      expect(await prisma.withdrawal.count({ where: { walletId: userA.walletId } })).toBe(preCount);
    });

    it("4. Rejects request without session with 401 UNAUTHORIZED", async () => {
      currentSessionUser = null;
      const req = new Request("http://localhost:3000/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 100_000,
          bankAccountId: userA.bankAccountId,
          pin: defaultPin,
        }),
      });

      const res = await postWithdraw(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("UNAUTHORIZED");
    });

    it("5. Rejects withdrawal with insufficient active balance and mutates nothing", async () => {
      currentSessionUser = {
        id: userA.id,
        email: userA.email,
        name: "User A Seller",
        role: "SELLER",
        isVerified: true,
        avatar: null,
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      };

      const preBalance = 5_000_000;
      const req = new Request("http://localhost:3000/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 10_000_000, // Balance is only 5_000_000
          bankAccountId: userA.bankAccountId,
          pin: defaultPin,
        }),
      });

      const res = await postWithdraw(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error).toBe("INSUFFICIENT_BALANCE");

      const postWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: userA.id } });
      expect(postWallet.activeBalance).toBe(preBalance);
    });

    it("6. Rejects withdrawal when user has not configured PIN (PIN_NOT_SET -> 409)", async () => {
      const ts = Date.now().toString().slice(-6);
      const userNoPin = await prisma.user.create({
        data: {
          email: `seller-nopin-${ts}@test.id`,
          name: "Seller No PIN",
          role: "SELLER",
          hashedPassword: await bcrypt.hash("Password123!", 10),
          hashedPin: null,
          wallet: {
            create: { activeBalance: 1_000_000, heldBalance: 0 },
          },
          bankAccounts: {
            create: {
              bankCode: "BCA",
              bankName: "BCA",
              accountNumber: "1122334455",
              accountHolder: "Seller No PIN",
              isDefault: true,
            },
          },
        },
        include: { bankAccounts: true },
      });

      currentSessionUser = {
        id: userNoPin.id,
        email: userNoPin.email,
        name: "Seller No PIN",
        role: "SELLER",
        isVerified: true,
        avatar: null,
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      };

      const req = new Request("http://localhost:3000/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 50_000,
          bankAccountId: userNoPin.bankAccounts[0].id,
          pin: "123456",
        }),
      });

      const res = await postWithdraw(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe("PIN_NOT_SET");
    });

    it("7. Rejects malformed bankAccountId (empty string) with 400 VALIDATION_ERROR", async () => {
      currentSessionUser = {
        id: userA.id,
        email: userA.email,
        name: "User A Seller",
        role: "SELLER",
        isVerified: true,
        avatar: null,
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      };

      const req = new Request("http://localhost:3000/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 50_000,
          bankAccountId: "",
          pin: defaultPin,
        }),
      });

      const res = await postWithdraw(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("VALIDATION_ERROR");
      expect(data.details).toHaveProperty("bankAccountId");
    });
  });

  // =========================================================================
  // CATEGORY C: Canonical Idempotency & Replay Defense (Tasks 4B.6 & 4B.11)
  // =========================================================================
  describe("C. Canonical Idempotency (POST /api/wallet/withdraw)", () => {
    it("1. Replaying exact same Idempotency-Key returns canonical response and debits active balance exactly once", async () => {
      currentSessionUser = {
        id: userA.id,
        email: userA.email,
        name: "User A Seller",
        role: "SELLER",
        isVerified: true,
        avatar: null,
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      };

      const idempotencyKey = `exact-idemp-key-${Date.now()}`;
      const payload = {
        amount: 1_500_000,
        bankAccountId: userA.bankAccountId,
        pin: defaultPin,
      };

      // Attempt 1: First request executes transaction
      const req1 = new Request("http://localhost:3000/api/wallet/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const res1 = await postWithdraw(req1);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.success).toBe(true);
      expect(data1.isDuplicate).toBe(false);
      expect(data1.newActiveBalance).toBe(3_500_000);

      // Attempt 2: Replay of identical key returns cached canonical outcome
      const req2 = new Request("http://localhost:3000/api/wallet/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const res2 = await postWithdraw(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.success).toBe(true);
      expect(data2.isDuplicate).toBe(true);
      expect(data2.withdrawalId).toBe(data1.withdrawalId);
      expect(data2.withdrawalNumber).toBe(data1.withdrawalNumber);
      expect(data2.newActiveBalance).toBe(3_500_000);

      // DB Invariants: exactly 1 debit, exactly 1 Withdrawal row, exactly 1 ledger row
      const finalWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: userA.id } });
      expect(finalWallet.activeBalance).toBe(3_500_000);

      const withdrawals = await prisma.withdrawal.findMany({
        where: { idempotencyKey },
      });
      expect(withdrawals.length).toBe(1);

      const ledgers = await prisma.walletLedgerEntry.findMany({
        where: { idempotencyKey },
      });
      expect(ledgers.length).toBe(1);
    });
  });
});
