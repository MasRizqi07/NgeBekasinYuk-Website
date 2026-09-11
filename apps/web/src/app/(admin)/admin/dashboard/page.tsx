"use client";

import React from "react";
import Link from "next/link";
import {
  DollarSign,
  Lock,
  Gavel,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Clock,
  CheckCircle2,
  Users,
  Package,
} from "lucide-react";
import { useOrderStore } from "@/stores/useOrderStore";
import { useDisputeStore } from "@/stores/useDisputeStore";
import { formatRupiah } from "@/lib/utils";

export default function AdminDashboardPage() {
  const { orders } = useOrderStore();
  const { disputes } = useDisputeStore();

  return (
    <div className="space-y-6 pb-20 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-on-surface">Platform Operations Overview</h1>
          <p className="text-on-surface-variant">
            Metrik performa real-time sistem escrow, sengketa, dan perputaran dana marketplace
          </p>
        </div>
        <Link
          href="/admin/disputes"
          className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold shadow-xs hover:bg-primary/90 flex items-center gap-1.5"
        >
          <Gavel className="w-4 h-4" />
          <span>Buka Konsol Mediasi Sengketa</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
            <span className="uppercase tracking-wider font-semibold">Total Escrow GMV</span>
            <DollarSign className="w-4 h-4 text-secondary" />
          </div>
          <div className="text-xl font-black text-on-surface">Rp 3.842.500.000</div>
          <span className="text-secondary font-bold text-[11px] flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +18.4% bulan ini
          </span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
            <span className="uppercase tracking-wider font-semibold">Dana Ditampung di Escrow</span>
            <Lock className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-black text-primary">Rp 1.240.800.000</div>
          <span className="text-on-surface-variant text-[11px]">Rekening Kustodian BCA &amp; Mandiri</span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
            <span className="uppercase tracking-wider font-semibold">Kasus Sengketa Aktif</span>
            <Gavel className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-xl font-black text-red-700">{disputes.length} Tiket</div>
          <span className="text-amber-700 font-bold text-[11px]">SLA Mediasi Terdekat: &lt; 4 Jam</span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
            <span className="uppercase tracking-wider font-semibold">Verifikasi e-KYC Pending</span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-black text-on-surface">28 Pengajuan</div>
          <span className="text-primary font-bold text-[11px]">SLA Review Otomatis Dukcapil</span>
        </div>
      </div>

      {/* Recent Orders Overview */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-on-surface">Aktivitas Transaksi Rekber Terbaru</h2>
          <Link href="/orders" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
            <span>Lihat Semua</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-outline-variant/20">
          {orders.slice(0, 5).map((order) => (
            <div key={order.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary">{order.id}</span>
                  <span className="text-outline-variant">•</span>
                  <span className="font-semibold text-on-surface truncate">{order.listing.title}</span>
                </div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  Pembeli: {order.buyerName} • Kurir: {order.courier}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-bold text-on-surface">{formatRupiah(order.totalAmount)}</div>
                <span className="inline-block px-2 py-0.2 rounded-full text-[10px] font-bold bg-surface-container-high text-on-surface mt-0.5">
                  {order.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
