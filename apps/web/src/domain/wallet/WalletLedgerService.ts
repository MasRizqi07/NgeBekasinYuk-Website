// NgeBekasinYuk Wallet Ledger Service
// Authoritative balance calculations, PIN rate-limiting, and withdrawal workflows with concurrency protection (HP2-P0-05).

import { prisma } from "@/server/db/prisma";
import bcrypt from "bcryptjs";
import { assertValidMoney, Money } from "@/domain/money";
import { buildIdempotencyKey, generateWithdrawalNumber } from "@/domain/id";

const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

export class WalletDomainError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "WalletDomainError";
    this.code = code;
  }
}

export interface PinVerificationResult {
  valid: boolean;
  locked: boolean;
  remainingAttempts?: number;
  lockUntil?: Date | null;
  message?: string;
}

export interface WithdrawalRequestResult {
  success: boolean;
  isDuplicate: boolean;
  withdrawalId: string;
  withdrawalNumber: string;
  amount: Money;
  fee: Money;
  newActiveBalance: Money;
  status: string;
  isSimulation: boolean;
  idempotencyKey: string;
}

export class WalletLedgerService {
  /**
   * Verifies the user's 6-digit transaction PIN server-side.
   * Enforces rate-limiting and temporary account lockout.
   */
  static async verifyPin(userId: string, plainPin: string): Promise<PinVerificationResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        hashedPin: true,
        pinFailedAttempts: true,
        pinLockedUntil: true,
      },
    });

    if (!user) {
      throw new WalletDomainError("USER_NOT_FOUND", "User not found");
    }

    const now = new Date();

    // 1. Check if PIN is currently locked
    if (user.pinLockedUntil && user.pinLockedUntil > now) {
      return {
        valid: false,
        locked: true,
        lockUntil: user.pinLockedUntil,
        message: `PIN terkunci sementara karena 5x salah percobaan. Coba lagi setelah ${user.pinLockedUntil.toLocaleTimeString("id-ID")}.`,
      };
    }

    // 2. Validate format: must be exactly 6 numeric digits
    if (!/^\d{6}$/.test(plainPin)) {
      return {
        valid: false,
        locked: false,
        message: "PIN harus berupa 6 digit angka.",
      };
    }

    // If no hashed PIN exists, reject safely
    if (!user.hashedPin) {
      return {
        valid: false,
        locked: false,
        message: "PIN transaksi belum dibuat. Silakan atur PIN di profil.",
      };
    }

    // 3. Compare with bcrypt hash
    const isMatch = await bcrypt.compare(plainPin, user.hashedPin);

    if (isMatch) {
      // Reset failed attempts on success
      if (user.pinFailedAttempts > 0 || user.pinLockedUntil) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            pinFailedAttempts: 0,
            pinLockedUntil: null,
          },
        });
      }
      return { valid: true, locked: false };
    }

    // 4. Failed attempt handling
    const newAttempts = user.pinFailedAttempts + 1;
    const shouldLock = newAttempts >= MAX_PIN_ATTEMPTS;
    const lockUntil = shouldLock ? new Date(now.getTime() + PIN_LOCK_DURATION_MS) : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        pinFailedAttempts: newAttempts,
        pinLockedUntil: lockUntil,
      },
    });

    // Security audit log for failed attempts
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: shouldLock ? "PIN_LOCKED" : "PIN_ATTEMPT_FAILED",
        targetType: "User",
        targetId: user.id,
        details: JSON.stringify({
          attemptCount: newAttempts,
          locked: shouldLock,
          lockUntil,
        }),
      },
    });

    if (shouldLock) {
      return {
        valid: false,
        locked: true,
        lockUntil,
        message: "PIN telah terkunci selama 15 menit karena 5 kali salah memasukkan PIN.",
      };
    }

    const remaining = MAX_PIN_ATTEMPTS - newAttempts;
    return {
      valid: false,
      locked: false,
      remainingAttempts: remaining,
      message: `PIN salah. Sisa kesempatan: ${remaining} kali sebelum terkunci.`,
    };
  }

  /**
   * Requests a withdrawal from seller active balance to registered bank account.
   * Enforces transactional conditional decrement to prevent race conditions and lost updates.
   * Unique operation idempotency ensures future legitimate withdrawals are not blocked.
   */
  static async requestWithdrawal(params: {
    userId: string;
    amount: Money;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    pin: string;
    customIdempotencyKey?: string;
  }): Promise<WithdrawalRequestResult> {
    const {
      userId,
      amount,
      bankName,
      accountNumber,
      accountHolder,
      pin,
      customIdempotencyKey,
    } = params;

    assertValidMoney(amount, "withdrawal amount");
    if (amount < 10000) {
      throw new WalletDomainError(
        "INVALID_AMOUNT",
        "Minimal penarikan saldo adalah Rp 10.000"
      );
    }

    // 1. Server-side PIN verification
    const pinCheck = await this.verifyPin(userId, pin);
    if (!pinCheck.valid) {
      throw new WalletDomainError("INVALID_PIN", pinCheck.message || "PIN tidak valid");
    }

    // 2. Fetch wallet
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new WalletDomainError("WALLET_NOT_FOUND", "Dompet pengguna belum terdaftar");
    }

    // Fast preliminary check before transaction
    if (wallet.activeBalance < amount) {
      throw new WalletDomainError(
        "INSUFFICIENT_BALANCE",
        `Saldo aktif tidak mencukupi (Tersedia: Rp ${wallet.activeBalance.toLocaleString("id-ID")}, Diminta: Rp ${amount.toLocaleString("id-ID")})`
      );
    }

    // Request-scoped or operation-specific idempotency key (HP2-P1-10)
    // Ensures retries of the SAME request are deduplicated without blocking future distinct requests
    const withdrawalNumber = generateWithdrawalNumber();
    const idempotencyKey =
      customIdempotencyKey ||
      buildIdempotencyKey("WITHDRAWAL", wallet.id, withdrawalNumber);

    const fee = 0; // Rp 0 BI-FAST launch promo

    // ATOMIC DATABASE TRANSACTION WITH CONCURRENCY BALANCE PROTECTION
    return await prisma.$transaction(async (tx) => {
      // 1. Idempotency check: if this exact request ID was already processed, return cached outcome
      const existingWithdrawal = await tx.withdrawal.findUnique({
        where: { idempotencyKey },
      });

      if (existingWithdrawal) {
        const currentWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });
        return {
          success: true,
          isDuplicate: true,
          withdrawalId: existingWithdrawal.id,
          withdrawalNumber: existingWithdrawal.withdrawalNumber,
          amount: existingWithdrawal.amount,
          fee: existingWithdrawal.fee,
          newActiveBalance: currentWallet ? currentWallet.activeBalance : 0,
          status: existingWithdrawal.status,
          isSimulation: existingWithdrawal.isSimulation,
          idempotencyKey,
        };
      }

      // 2. Atomic conditional decrement: guarantees that balance >= amount at the moment of decrement
      const decrementResult = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          activeBalance: { gte: amount },
        },
        data: {
          activeBalance: { decrement: amount },
        },
      });

      if (decrementResult.count === 0) {
        throw new WalletDomainError(
          "INSUFFICIENT_BALANCE",
          "Saldo aktif tidak mencukupi untuk memproses penarikan ini."
        );
      }

      // Read current balance after atomic decrement
      const currentWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: wallet.id },
        select: { activeBalance: true },
      });

      const newActiveBalance = currentWallet.activeBalance;

      // 3. Create withdrawal record (honestly marked as simulation)
      const withdrawal = await tx.withdrawal.create({
        data: {
          withdrawalNumber,
          walletId: wallet.id,
          amount,
          fee,
          bankName,
          accountNumber,
          accountHolder,
          status: "SUCCESS", // Demo/Simulation completes immediately
          providerRef: `SIM-BOD-${Date.now().toString().slice(-6)}`,
          isSimulation: true,
          completedAt: new Date(),
          idempotencyKey,
        },
      });

      // 4. Write immutable Wallet Ledger Entry (DEBIT)
      await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          type: "WITHDRAWAL",
          direction: "DEBIT",
          amount,
          balanceAfter: newActiveBalance,
          referenceType: "WITHDRAWAL",
          referenceId: withdrawal.id,
          idempotencyKey,
          description: `Penarikan saldo ke ${bankName} (${accountNumber}) [Simulasi BI-FAST]`,
        },
      });

      // 5. Append audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: "WITHDRAW_REQUEST",
          targetType: "Withdrawal",
          targetId: withdrawal.id,
          details: JSON.stringify({
            withdrawalNumber,
            amount,
            bankName,
            accountNumber,
            isSimulation: true,
            idempotencyKey,
          }),
        },
      });

      return {
        success: true,
        isDuplicate: false,
        withdrawalId: withdrawal.id,
        withdrawalNumber: withdrawal.withdrawalNumber,
        amount: withdrawal.amount,
        fee: withdrawal.fee,
        newActiveBalance,
        status: withdrawal.status,
        isSimulation: withdrawal.isSimulation,
        idempotencyKey,
      };
    });
  }
}
