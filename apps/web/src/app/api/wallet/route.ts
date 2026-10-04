// NgeBekasinYuk Server-Authoritative Wallet Read API (Phase 4B)
// PostgreSQL is the single source of truth for balances, security state, registered bank accounts, and ledger entries.

import { NextResponse } from "next/server";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { prisma } from "@/server/db/prisma";
import { maskAccountNumber } from "@/lib/utils";

export async function GET() {
  const session = await validateAuthoritativeSession();
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      hashedPin: true,
      wallet: {
        select: {
          id: true,
          activeBalance: true,
          heldBalance: true,
        },
      },
      bankAccounts: {
        select: {
          id: true,
          bankCode: true,
          bankName: true,
          accountHolder: true,
          accountNumber: true,
          isDefault: true,
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!user || !user.wallet) {
    return NextResponse.json(
      { error: "WALLET_NOT_FOUND", message: "Dompet pengguna tidak ditemukan." },
      { status: 404 }
    );
  }

  const ledgerEntries = await prisma.walletLedgerEntry.findMany({
    where: { walletId: user.wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      direction: true,
      amount: true,
      balanceAfter: true,
      referenceType: true,
      referenceId: true,
      description: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    wallet: {
      activeBalance: user.wallet.activeBalance,
      heldBalance: user.wallet.heldBalance,
    },
    security: {
      hasPin: user.hashedPin !== null,
    },
    bankAccounts: user.bankAccounts.map((b) => ({
      id: b.id,
      bankCode: b.bankCode,
      bankName: b.bankName,
      accountHolder: b.accountHolder,
      accountNumberMasked: maskAccountNumber(b.accountNumber),
      isDefault: b.isDefault,
    })),
    ledgerEntries: ledgerEntries.map((e) => ({
      id: e.id,
      type: e.type,
      direction: e.direction,
      amount: e.amount,
      balanceAfter: e.balanceAfter,
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      description: e.description,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
