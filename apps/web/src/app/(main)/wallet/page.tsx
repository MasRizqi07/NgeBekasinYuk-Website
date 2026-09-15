"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Wallet,
  Building2,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  KeyRound,
  Info,
} from "lucide-react";
import { useWalletStore } from "@/stores/useWalletStore";
import { formatRupiah } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import confetti from "canvas-confetti";

type LedgerTab = "ALL" | "IN" | "OUT" | "HOLD";

export default function WalletPage() {
  const { saldoAktif, saldoTertahan, bankAccounts, transactions, withdrawFunds } =
    useWalletStore();
  const { showToast } = useToast();

  const [showBalance, setShowBalance] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(14250000);
  const [selectedBankId, setSelectedBankId] = useState(bankAccounts[0]?.id || "bca-1");
  const [pin, setPin] = useState("123456");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<LedgerTab>("ALL");
  const [clientRequestId, setClientRequestId] = useState<string | null>(null);

  const handleQuickChip = (val: number) => {
    setWithdrawAmount(val);
    setClientRequestId(null);
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    const requestId = clientRequestId || crypto.randomUUID();
    if (!clientRequestId) {
      setClientRequestId(requestId);
    }

    try {
      const res = await withdrawFunds(withdrawAmount, selectedBankId, pin, requestId);
      setIsProcessing(false);

      if (res.success) {
        setClientRequestId(null);
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
        showToast(res.message, "success");
      } else if (res.status === "UNKNOWN") {
        // AMBIGUOUS / PENDING: server state unconfirmed due to timeout/network error
        // Retain clientRequestId so subsequent retry reuses identical Idempotency-Key
        showToast(res.message, "warning", "Status Penarikan Belum Dipastikan");
      } else {
        setClientRequestId(null);
        showToast(res.message, "error", "Penarikan Gagal");
      }
    } catch {
      setIsProcessing(false);
      // Unhandled client runtime error: do not assert failure; retain requestId and warn
      showToast(
        "Status penarikan belum bisa dipastikan (koneksi terputus/timeout). Cek riwayat transaksi sebelum mencoba lagi.",
        "warning",
        "Status Penarikan Belum Dipastikan"
      );
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "IN") return t.type === "ESCROW_RELEASE";
    if (activeTab === "OUT") return t.type === "WITHDRAWAL";
    if (activeTab === "HOLD") return t.type === "ESCROW_HOLD";
    return true;
  });

  return (
    <div className="min-h-screen bg-surface pb-32 pt-4">
      <div className="max-w-xl mx-auto px-4 space-y-4">
        {/* Top Escrow Protected Banner */}
        <div className="bg-surface-container-low rounded-2xl p-3.5 flex items-center justify-between border border-outline-variant/30 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="w-5 h-5 text-secondary shrink-0" />
            <p className="text-xs font-semibold text-on-surface truncate">
              Proteksi Rekber Aktif • Garansi Transaksi 100% Aman
            </p>
          </div>
          <Link
            href="/help/escrow"
            className="text-xs font-bold text-primary hover:underline shrink-0"
          >
            Pusat Bantuan
          </Link>
        </div>

        {/* Balance Card with Trust Blue Gradient & Escrow Tokens */}
        <div className="relative overflow-hidden rounded-3xl bg-primary text-on-primary p-6 shadow-xl shadow-primary/20 space-y-4">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>

          {/* Top Custodian Tag */}
          <div className="flex items-center justify-between relative z-10 text-xs">
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-white font-medium">
              <Lock className="w-3.5 h-3.5" />
              <span>Rekening Escrow PT NgeBekasin</span>
            </div>
            <span className="bg-secondary-fixed text-on-secondary-fixed px-2.5 py-1 rounded-full font-bold text-[11px] shadow-xs">
              Kustodian BI Terdaftar
            </span>
          </div>

          {/* Saldo Aktif */}
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between text-xs text-white/80">
              <span>Saldo Tersedia untuk Ditarik</span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="hover:text-white transition-colors"
              >
                {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tight">
              {showBalance ? formatRupiah(saldoAktif) : "Rp ••••••••"}
            </div>
          </div>

          <div className="h-px bg-white/15 relative z-10"></div>

          {/* Saldo Tertahan Escrow */}
          <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-4 h-4 text-amber-300 animate-pulse" />
              <div>
                <span className="font-semibold block text-white">Saldo Tertahan di Escrow</span>
                <span className="text-[11px] text-white/70">
                  Dalam masa inspeksi pembeli 2x24 jam
                </span>
              </div>
            </div>
            <span className="font-bold text-sm text-white">
              {showBalance ? formatRupiah(saldoTertahan) : "••••••••"}
            </span>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-3 gap-2 bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant/30 shadow-xs text-center text-xs">
          <div className="p-1">
            <span className="text-[11px] text-on-surface-variant block">Selesai Bulan Ini</span>
            <span className="font-bold text-sm text-on-surface mt-0.5 block">18 Gadget</span>
          </div>
          <div className="p-1 bg-surface-container-low rounded-xl">
            <span className="text-[11px] text-on-surface-variant block">Pencairan Sukses</span>
            <span className="font-bold text-sm text-secondary mt-0.5 block">100%</span>
          </div>
          <div className="p-1">
            <span className="text-[11px] text-on-surface-variant block">Kecepatan Rata-rata</span>
            <span className="font-bold text-sm text-primary mt-0.5 block">&lt; 3 Mnt</span>
          </div>
        </div>

        {/* Linked Bank Account (KYC Verified) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-1.5 font-bold text-on-surface">
              <Building2 className="w-4 h-4 text-primary" />
              <span>Rekening Pencairan Terdaftar</span>
            </div>
            <span className="text-secondary font-bold text-[11px] flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" />
              <span>KYC Match</span>
            </span>
          </div>

          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-10 rounded-xl bg-primary-fixed flex items-center justify-center font-black text-primary text-sm">
                  BCA
                </div>
                <div className="text-xs">
                  <div className="font-bold text-on-surface flex items-center gap-1.5">
                    <span>Bank Central Asia (BCA)</span>
                    <span className="bg-secondary-fixed text-on-secondary-fixed text-[10px] px-1.5 py-0.2 rounded font-bold">
                      UTAMA
                    </span>
                  </div>
                  <p className="font-mono text-on-surface-variant mt-0.5">8271 •••• 9102</p>
                  <p className="text-[11px] text-on-surface-variant font-medium">
                    a.n. Achmad Rizqi Mubarok
                  </p>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
            </div>

            <div className="p-2.5 bg-surface-container-low rounded-xl text-[11px] text-on-surface-variant flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span>
                Nama rekening 100% identik dengan e-KTP KYC terverifikasi demi kepatuhan anti-fraud &amp; regulasi Bank Indonesia.
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Withdrawal Form */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between text-xs border-b border-outline-variant/20 pb-2.5">
            <div className="flex items-center gap-1.5 font-bold text-on-surface">
              <Wallet className="w-4 h-4 text-primary" />
              <span>Formulir Tarik Dana</span>
            </div>
            <span className="bg-surface-container text-on-surface-variant text-[10px] px-2 py-0.5 rounded-full font-semibold">
              BI-FAST 24/7 (Bebas Biaya)
            </span>
          </div>

          <form onSubmit={handleWithdraw} className="space-y-3.5 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-on-surface">Nominal Penarikan</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-on-surface-variant font-bold text-sm">
                  Rp
                </span>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => {
                    setWithdrawAmount(Number(e.target.value));
                    setClientRequestId(null);
                  }}
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-bold text-base focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
                />
              </div>

              {/* Quick chips */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[
                  { label: "500 Rb", val: 500000 },
                  { label: "2 Juta", val: 2000000 },
                  { label: "5 Juta", val: 5000000 },
                  { label: "Semua", val: saldoAktif },
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickChip(chip.val)}
                    className="py-1.5 bg-surface-container-low hover:bg-primary-fixed rounded-lg text-xs font-semibold text-on-surface text-center transition-colors"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Destination Bank Account */}
            <div className="space-y-1.5">
              <label className="font-bold text-on-surface">Rekening Tujuan</label>
              <select
                value={selectedBankId}
                onChange={(e) => {
                  setSelectedBankId(e.target.value);
                  setClientRequestId(null);
                }}
                className="w-full p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 text-on-surface font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountNumber} ({b.accountHolder})
                  </option>
                ))}
              </select>
            </div>

            {/* Security PIN Input */}
            <div className="p-3 bg-surface-container-low rounded-xl text-center space-y-1.5 border border-outline-variant/30">
              <div className="flex items-center justify-center gap-1 text-on-surface-variant font-medium">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Otorisasi PIN Transaksi (6 Digit)</span>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full ${
                      pin.length >= i ? "bg-primary" : "bg-surface-container-highest"
                    }`}
                  ></div>
                ))}
              </div>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setClientRequestId(null);
                }}
                placeholder="Masukkan 6 digit PIN"
                className="w-40 mx-auto text-center font-mono tracking-widest text-xs py-1.5 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[10px] text-on-surface-variant">Default simulator PIN: 123456</p>
            </div>

            {/* Submit Payout Button */}
            <button
              type="submit"
              disabled={isProcessing || withdrawAmount <= 0}
              className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {isProcessing
                  ? "Mentransfer via BI-FAST..."
                  : `Konfirmasi & Tarik ${formatRupiah(withdrawAmount)} Sekarang`}
              </span>
            </button>
          </form>
        </div>

        {/* Transaction Ledger */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs px-1">
            <h3 className="font-bold text-on-surface">Riwayat &amp; Mutasi Saldo</h3>
            <span className="text-on-surface-variant">Oktober 2026</span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
            {[
              { id: "ALL", label: "Semua Mutasi" },
              { id: "IN", label: "Dana Masuk (+)" },
              { id: "OUT", label: "Penarikan (-)" },
              { id: "HOLD", label: "Pending Escrow" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as LedgerTab)}
                className={`px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Ledger Entries */}
          <div className="space-y-2.5">
            {filteredTransactions.map((trx) => (
              <div
                key={trx.id}
                className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        trx.type === "ESCROW_RELEASE"
                          ? "bg-secondary-fixed text-on-secondary-fixed"
                          : trx.type === "WITHDRAWAL"
                          ? "bg-surface-container-high text-on-surface"
                          : "bg-amber-500/10 text-amber-700"
                      }`}
                    >
                      {trx.type === "ESCROW_RELEASE" ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : trx.type === "WITHDRAWAL" ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-on-surface truncate">{trx.description}</h4>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">
                        Ref: {trx.referenceId} • {trx.timestamp}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-mono font-bold shrink-0 text-sm ${
                      trx.type === "ESCROW_RELEASE"
                        ? "text-secondary"
                        : trx.type === "WITHDRAWAL"
                        ? "text-on-surface"
                        : "text-amber-700"
                    }`}
                  >
                    {trx.type === "WITHDRAWAL" ? "-" : "+"}
                    {formatRupiah(trx.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
