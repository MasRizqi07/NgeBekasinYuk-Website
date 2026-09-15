import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BankAccount, WalletTransaction } from "../types";
import { SEED_BANK_ACCOUNTS, SEED_WALLET_TRANSACTIONS } from "../lib/seedData";

interface WalletStore {
  saldoAktif: number;
  saldoTertahan: number;
  bankAccounts: BankAccount[];
  transactions: WalletTransaction[];

  withdrawFunds: (
    amount: number,
    bankId: string,
    pin: string,
    clientRequestId: string
  ) => Promise<{ success: boolean; status: "SUCCESS" | "FAILED" | "UNKNOWN"; message: string }>;
  releaseEscrowToWallet: (amount: number, orderId: string, itemTitle: string) => void;
  holdEscrowFunds: (amount: number, orderId: string, itemTitle: string) => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      saldoAktif: 14250000,
      saldoTertahan: 6800000,
      bankAccounts: SEED_BANK_ACCOUNTS,
      transactions: SEED_WALLET_TRANSACTIONS,

      withdrawFunds: async (amount, bankId, pin, clientRequestId) => {
        const { saldoAktif, bankAccounts } = get();

        // P0-04 FIX: Strict 6-digit numeric validation, never allowing arbitrary 6-digit numbers
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

        const bank = bankAccounts.find((b) => b.id === bankId) || bankAccounts[0];

        try {
          const res = await fetch("/api/wallet/withdraw", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount,
              bankName: bank.bankName,
              accountNumber: bank.accountNumber,
              accountHolder: bank.accountHolder,
              pin,
              clientRequestId,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            return {
              success: false,
              status: "FAILED",
              message: data.message || "Gagal memproses penarikan saldo.",
            };
          }

          const newTrx: WalletTransaction = {
            id: data.withdrawalNumber || `WD-${Date.now().toString().slice(-6)}`,
            type: "WITHDRAWAL",
            amount,
            referenceId: data.withdrawalId || `TF-${Math.floor(100000 + Math.random() * 900000)}`,
            status: "SUCCESS",
            timestamp: "Baru saja",
            description: `Penarikan saldo ke Rekening ${bank.bankName} (${bank.accountNumber.slice(-4)}) [Simulasi BI-FAST]`,
          };

          set((state) => ({
            saldoAktif: state.saldoAktif - amount,
            transactions: [newTrx, ...state.transactions],
          }));

          return {
            success: true,
            status: "SUCCESS",
            message: `Penarikan Rp ${amount.toLocaleString("id-ID")} ke ${bank.bankName} berhasil diproses! [Simulasi BI-FAST]`,
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

      releaseEscrowToWallet: (amount, orderId, itemTitle) => {
        const newTrx: WalletTransaction = {
          id: `ESC-REL-${Date.now().toString().slice(-6)}`,
          type: "ESCROW_RELEASE",
          amount,
          referenceId: orderId,
          status: "SUCCESS",
          timestamp: "Baru saja",
          description: `Pencairan dana Escrow pesanan: ${itemTitle}`,
        };

        set((state) => ({
          saldoAktif: state.saldoAktif + amount,
          saldoTertahan: Math.max(0, state.saldoTertahan - amount),
          transactions: [newTrx, ...state.transactions],
        }));
      },

      holdEscrowFunds: (amount, orderId, itemTitle) => {
        const newTrx: WalletTransaction = {
          id: `ESC-HLD-${Date.now().toString().slice(-6)}`,
          type: "ESCROW_HOLD",
          amount,
          referenceId: orderId,
          status: "PENDING",
          timestamp: "Baru saja",
          description: `Dana Escrow tertahan masa inspeksi: ${itemTitle}`,
        };

        set((state) => ({
          saldoTertahan: state.saldoTertahan + amount,
          transactions: [newTrx, ...state.transactions],
        }));
      },
    }),
    {
      name: "ngebekasinyuk-wallet-storage",
    }
  )
);
