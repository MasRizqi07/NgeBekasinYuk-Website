// NgeBekasinYuk Server-Authoritative Wallet Store (Phase 4B)
// Replaces client-authoritative state and localStorage persistence with PostgreSQL read-side query cache.

import { create } from "zustand";
import { BankAccount, WalletTransaction } from "../types";
import { formatRupiah, timeAgo } from "../lib/utils";

interface WalletStore {
  saldoAktif: number;
  saldoTertahan: number;
  hasPin: boolean;
  bankAccounts: BankAccount[];
  transactions: WalletTransaction[];
  isLoading: boolean;
  error: string | null;

  fetchWallet: () => Promise<void>;
  withdrawFunds: (
    amount: number,
    bankAccountId: string,
    pin: string,
    clientRequestId: string
  ) => Promise<{
    success: boolean;
    status: "SUCCESS" | "FAILED" | "UNKNOWN";
    message: string;
    code?: string;
    statusCode?: number;
  }>;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  // Non-persistent initial UI state: zero balances until hydrated from PostgreSQL
  saldoAktif: 0,
  saldoTertahan: 0,
  hasPin: true,
  bankAccounts: [],
  transactions: [],
  isLoading: false,
  error: null,

  fetchWallet: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/wallet");
      if (!res.ok) {
        if (res.status === 401) {
          set({ isLoading: false });
          return;
        }
        set({ isLoading: false, error: "Gagal memuat data dompet dari server." });
        return;
      }

      const data = await res.json();
      set({
        saldoAktif: data.wallet.activeBalance,
        saldoTertahan: data.wallet.heldBalance,
        hasPin: data.security.hasPin,
        bankAccounts: (data.bankAccounts || []).map((b: {
          id: string;
          bankCode: string;
          bankName: string;
          accountHolder: string;
          accountNumberMasked: string;
          isDefault: boolean;
        }) => ({
          id: b.id,
          bankName: b.bankName,
          accountNumber: b.accountNumberMasked,
          accountHolder: b.accountHolder,
          isPrimary: b.isDefault,
        })),
        transactions: (data.ledgerEntries || []).map((e: {
          id: string;
          type: "ESCROW_HOLD" | "ESCROW_RELEASE" | "WITHDRAWAL" | "REFUND";
          amount: number;
          referenceId: string;
          createdAt: string;
          description: string;
        }) => ({
          id: e.id,
          type: e.type,
          amount: e.amount,
          referenceId: e.referenceId,
          status: "SUCCESS" as const,
          timestamp: timeAgo(e.createdAt),
          description: e.description,
        })),
        isLoading: false,
        error: null,
      });
    } catch {
      set({ isLoading: false, error: "Koneksi terputus saat memuat dompet." });
    }
  },

  withdrawFunds: async (amount, bankAccountId, pin, clientRequestId) => {
    const { saldoAktif } = get();

    // Strict 6-digit numeric validation
    if (!/^\d{6}$/.test(pin)) {
      return { success: false, status: "FAILED", message: "PIN transaksi harus berupa 6 digit angka." };
    }

    if (amount < 10000) {
      return { success: false, status: "FAILED", message: "Minimal penarikan saldo adalah Rp 10.000." };
    }

    if (amount > saldoAktif) {
      return {
        success: false,
        status: "FAILED",
        message: "Saldo tersedia tidak mencukupi untuk penarikan ini.",
      };
    }

    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": clientRequestId,
        },
        body: JSON.stringify({
          amount,
          bankAccountId,
          pin,
          clientRequestId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          status: "FAILED",
          statusCode: res.status,
          code: data.error,
          message: data.message || "Gagal memproses penarikan saldo.",
        };
      }

      // Authoritative balance reconciliation
      const newActiveBalance =
        typeof data.newActiveBalance === "number"
          ? data.newActiveBalance
          : get().saldoAktif - amount;

      const newTrx: WalletTransaction = {
        id: data.withdrawalNumber || data.withdrawalId || `WDR-${Date.now()}`,
        type: "WITHDRAWAL",
        amount,
        referenceId: data.withdrawalNumber || data.withdrawalId || "WDR",
        status: "SUCCESS",
        timestamp: "Baru saja",
        description: `Penarikan saldo [Simulasi Transfer]`,
      };

      set((state) => ({
        saldoAktif: newActiveBalance,
        transactions: [newTrx, ...state.transactions],
      }));

      // Asynchronously reconcile authoritative read snapshot from PostgreSQL
      get().fetchWallet().catch(() => {});

      return {
        success: true,
        status: "SUCCESS",
        message: `Penarikan ${formatRupiah(amount)} berhasil diproses! [Simulasi Transfer]`,
      };
    } catch (err) {
      // SECURITY FIX: never fabricate a successful withdrawal client-side.
      // A network/fetch failure means we do NOT know the server's true state,
      // so local balance/transactions must stay untouched and the caller must
      // be told the operation did not complete.
      console.error("[useWalletStore] withdrawFunds request failed:", err);
      return {
        success: false,
        status: "UNKNOWN",
        message:
          "Status penarikan belum bisa dipastikan (koneksi terputus/timeout). Cek mutasi saldo sebelum mencoba lagi — jika Anda mencoba lagi, permintaan ini menggunakan Idempotency-Key yang aman dan tidak akan memotong saldo dua kali.",
      };
    }
  },
}));
