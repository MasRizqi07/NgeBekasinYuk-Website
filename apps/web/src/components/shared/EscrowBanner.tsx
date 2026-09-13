import React from "react";
import Link from "next/link";
import { ShieldCheck, Clock, CheckCircle2, ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface EscrowBannerProps {
  variant?: "hero" | "compact" | "steps";
  className?: string;
}

export function EscrowBanner({ variant = "compact", className }: EscrowBannerProps) {
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "w-full bg-linear-to-r from-secondary-container/25 via-surface-subtle to-primary-fixed/20 p-3.5 rounded-2xl flex items-center justify-between gap-3 border border-brand-secondary/20 shadow-xs",
          className
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-brand-secondary text-white flex items-center justify-center shrink-0 shadow-sm">
            <Lock className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-on-surface truncate">
                100% Proteksi Dana Escrow
              </span>
              <span className="text-[10px] bg-brand-secondary-light text-brand-secondary font-bold px-1.5 py-0.2 rounded-full">
                Resmi
              </span>
            </div>
            <p className="text-xs text-text-secondary truncate mt-0.5">
              Uangmu ditahan aman sampai kamu cek fisik & uji fungsi 2x24 jam.
            </p>
          </div>
        </div>
        <Link
          href="/help/escrow"
          className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-0.5 shrink-0"
        >
          <span>Pelajari</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  if (variant === "steps") {
    return (
      <div className={cn("bg-surface-card rounded-2xl p-4 border border-surface-border shadow-sm flex flex-col gap-3", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-primary text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-on-surface">3 Tahap Transaksi Aman Rekber</h3>
          </div>
          <span className="text-[11px] font-bold text-brand-secondary">Anti Tipu-Tipu</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="flex flex-col items-center bg-surface-subtle p-2.5 rounded-xl">
            <div className="w-6 h-6 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center mb-1">
              1
            </div>
            <span className="text-xs font-bold text-on-surface">Bayar Escrow</span>
            <span className="text-[10px] text-text-muted mt-0.5">Dana diamankan sistem</span>
          </div>

          <div className="flex flex-col items-center bg-brand-secondary-light p-2.5 rounded-xl border border-brand-secondary/30">
            <div className="w-6 h-6 rounded-full bg-brand-secondary text-white text-xs font-bold flex items-center justify-center mb-1">
              2
            </div>
            <span className="text-xs font-bold text-brand-secondary">Inspeksi 48 Jam</span>
            <span className="text-[10px] text-text-secondary mt-0.5">Tes fungsi sepuasnya</span>
          </div>

          <div className="flex flex-col items-center bg-surface-subtle p-2.5 rounded-xl">
            <div className="w-6 h-6 rounded-full bg-[#FF7A00] text-white text-xs font-bold flex items-center justify-center mb-1">
              3
            </div>
            <span className="text-xs font-bold text-on-surface">Puas? Selesai</span>
            <span className="text-[10px] text-text-muted mt-0.5">Dana diteruskan ke seller</span>
          </div>
        </div>
      </div>
    );
  }

  // Hero variant
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-linear-to-br from-[#0F6FFF] via-brand-primary-hover to-[#0057CE] p-5 sm:p-7 text-white shadow-xl shadow-brand-primary/20",
        className
      )}
    >
      <div className="relative z-10 flex flex-col gap-3 max-w-xl">
        <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-xs font-semibold shadow-xs">
          <ShieldCheck className="w-4 h-4 text-secondary-container" />
          <span className="tracking-wide uppercase text-[11px]">Garansi Rekber Resmi Kustodian BI</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
          Jual Beli Gadget Bekas Tanpa Waswas 🔒
        </h1>

        <p className="text-sm sm:text-base text-white/90 leading-relaxed">
          Dana ditahan aman di escrow resmi. Penjual baru menerima pembayaran setelah kamu
          menguji fisik dan fungsi unit selama 2x24 jam.
        </p>

        <div className="grid grid-cols-3 gap-2 pt-2">
          <div className="flex flex-col items-center justify-center rounded-xl bg-white/15 p-2.5 text-center backdrop-blur-md border border-white/10">
            <Clock className="w-5 h-5 text-secondary-container" />
            <span className="text-xs font-bold mt-1">Uji 2x24 Jam</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl bg-white/15 p-2.5 text-center backdrop-blur-md border border-white/10">
            <CheckCircle2 className="w-5 h-5 text-secondary-container" />
            <span className="text-xs font-bold mt-1">Bisa Nego Santai</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl bg-white/15 p-2.5 text-center backdrop-blur-md border border-white/10">
            <ShieldCheck className="w-5 h-5 text-secondary-container" />
            <span className="text-xs font-bold mt-1">Anti Tipu-Tipu</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute -right-10 -bottom-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute top-0 right-10 h-32 w-32 rounded-full bg-[#00C48C]/25 blur-2xl" />
    </div>
  );
}
