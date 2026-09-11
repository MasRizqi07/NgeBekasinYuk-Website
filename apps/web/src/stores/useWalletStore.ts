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
    pin: string
  ) => { success: boolean; message: string };
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

      withdrawFunds: (amount, bankId, pin) => {
        const { saldoAktif, bankAccounts } = get();

        if (pin !== "123456" && pin.length !== 6) {
          return { success: false, message: "PIN transaksi salah atau kurang dari 6 digit." };
        }

        if (amount < 10000) {
          return { success: false, message: "Minimal penarikan saldo adalah Rp 10.000." };
        }

        if (amount > saldoAktif) {
          return {
            success: false,
            message: "Saldo tersedia tidak mencukupi untuk penarikan ini.",
          };
        }

        const bank = bankAccounts.find((b) => b.id === bankId) || bankAccounts[0];

        const newTrx: WalletTransaction = {
          id: `WD-${Date.now().toString().slice(-6)}`,
          type: "WITHDRAWAL",
          amount,
          referenceId: `TF-${Math.floor(100000 + Math.random() * 900000)}`,
          status: "SUCCESS",
          timestamp: "Baru saja",
          description: `Penarikan saldo ke Rekening ${bank.bankName} (${bank.accountNumber.slice(-4)})`,
        };

        set((state) => ({
          saldoAktif: state.saldoAktif - amount,
          transactions: [newTrx, ...state.transactions],
        }));

        return {
          success: true,
          message: `Penarikan Rp ${amount.toLocaleString("id-ID")} ke ${bank.bankName} berhasil diproses!`,
        };
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
