"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard,
  Lock,
  Truck,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  HelpCircle,
  FileCheck,
} from "lucide-react";
import { Order } from "@/types";
import { useOrderStore } from "@/stores/useOrderStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { formatInspectionCountdown } from "@/lib/utils";
import { ReviewModal } from "./ReviewModal";

interface OrderTimelineProps {
  order: Order;
}

export function OrderTimeline({ order }: OrderTimelineProps) {
  const { payOrder, shipOrder, simulateDelivered, confirmOrderReceived } =
    useOrderStore();

  const [resiModalOpen, setResiModalOpen] = useState(false);
  const [resiInput, setResiInput] = useState("");
  const [courierInput, setCourierInput] = useState(order.courier || "J&T Express");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Live countdown timer for INSPECTING state
  const [secondsRemaining, setSecondsRemaining] = useState(138000); // default ~38 hours

  useEffect(() => {
    if (order.status === "INSPECTING") {
      const timer = setInterval(() => {
        setSecondsRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [order.status]);

  const stages = [
    {
      key: "PENDING_PAYMENT",
      title: "Menunggu Pembayaran",
      desc: "Lakukan transfer ke rekening Virtual Account resmi.",
      icon: CreditCard,
    },
    {
      key: "FUNDED",
      title: "Dana Diamankan Escrow",
      desc: "Dana kamu terkunci aman di rekening bersama. Seller wajib kirim barang.",
      icon: Lock,
    },
    {
      key: "SHIPPED",
      title: "Barang Dalam Pengiriman",
      desc: order.trackingNumber
        ? `Kurir: ${order.courier} (Resi: ${order.trackingNumber})`
        : "Kurir sedang mengantarkan gadget ke alamat tujuan.",
      icon: Truck,
    },
    {
      key: "INSPECTING",
      title: "Paket Tiba & Masa Uji 2x24 Jam",
      desc: "Uji fungsi kamera, baterai, layar, dan kelengkapan sebelum dana dicairkan.",
      icon: Clock,
    },
    {
      key: "COMPLETED",
      title: "Pesanan Selesai & Dana Cair",
      desc: "Pembeli puas, transaksi selesai, dan dana telah diteruskan ke seller.",
      icon: CheckCircle2,
    },
  ];

  const getStageIndex = (status: string) => {
    switch (status) {
      case "PENDING_PAYMENT":
        return 0;
      case "FUNDED":
        return 1;
      case "SHIPPED":
        return 2;
      case "INSPECTING":
        return 3;
      case "COMPLETED":
        return 4;
      case "DISPUTED":
        return 3; // side branch
      default:
        return 0;
    }
  };

  const currentStageIndex = getStageIndex(order.status);

  const handleShipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resiInput.trim()) return;
    shipOrder(order.id, resiInput.trim(), courierInput);
    setResiModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Active State Highlight Banner */}
      {order.status === "INSPECTING" && (
        <div className="bg-[#FFF8EC] border border-[#FDE6BA] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-warning text-white flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-[#B26A00]">
                  Masa Inspeksi Mandiri Sedang Berlangsung!
                </h4>
                <span className="bg-[#FFE5B5] text-[#915400] text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                  2x24 Jam
                </span>
              </div>
              <p className="text-xs text-[#7A4B00] mt-0.5">
                Sisa Waktu Inspeksi:{" "}
                <span className="font-bold tabular-nums">
                  {formatInspectionCountdown(secondsRemaining)}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              href={`/disputes/${order.disputeId || "DSP-2026-88421"}`}
              className="flex-1 sm:flex-none"
            >
              <Button variant="outline" size="sm" className="w-full text-brand-danger border-brand-danger/30 hover:bg-brand-danger-soft">
                Ajukan Komplain
              </Button>
            </Link>
            <Button
              variant="success"
              size="sm"
              className="flex-1 sm:flex-none font-bold"
              onClick={() => {
                confirmOrderReceived(order.id);
                setReviewModalOpen(true);
              }}
            >
              Konfirmasi Barang Sesuai
            </Button>
          </div>
        </div>
      )}

      {order.status === "DISPUTED" && (
        <div className="bg-brand-danger-soft border border-brand-danger/30 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-danger text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-brand-danger">
                Tiket Komplain Sedang Dimediasi Admin
              </h4>
              <p className="text-xs text-text-secondary mt-0.5">
                Kasus: {order.disputeId || "DSP-2026-88421"} • Dana Rp{" "}
                {order.itemPrice.toLocaleString("id-ID")} dibekukan sampai investigasi tuntas.
              </p>
            </div>
          </div>
          <Link href={`/disputes/${order.disputeId || "DSP-2026-88421"}`}>
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              Buka Ruang Mediasi
            </Button>
          </Link>
        </div>
      )}

      {/* Vertical Stepper Timeline */}
      <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-xs flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <span className="font-bold text-sm text-on-surface">
            Status Perjalanan Rekber Escrow
          </span>
          <span className="text-xs font-semibold text-brand-secondary flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            100% Proteksi Dana
          </span>
        </div>

        <div className="relative pl-6 space-y-7 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-border">
          {stages.map((stage, idx) => {
            const isPassed = currentStageIndex > idx;
            const isCurrent = currentStageIndex === idx && order.status !== "DISPUTED";
            const isFuture = currentStageIndex < idx;

            const Icon = stage.icon;

            return (
              <div key={stage.key} className="relative flex items-start gap-3.5">
                {/* Node Dot */}
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs transition-colors z-10 ${
                    isPassed
                      ? "bg-brand-secondary text-white"
                      : isCurrent
                      ? "bg-brand-primary text-white ring-4 ring-brand-primary/20"
                      : "bg-surface-subtle text-text-muted border border-surface-border"
                  }`}
                >
                  {isPassed ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold text-sm ${
                        isCurrent
                          ? "text-brand-primary"
                          : isPassed
                          ? "text-on-surface"
                          : "text-text-muted"
                      }`}
                    >
                      {stage.title}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] bg-brand-primary-soft text-brand-primary font-bold px-2 py-0.2 rounded-full">
                        Tahap Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    {stage.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Interactive Testing Playground (For Prototype Demo) */}
        <div className="bg-surface-subtle p-4 rounded-xl border border-surface-border flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-brand-primary" />
            <span>Simulasi Interaksi Demo (Coba Semua Tahapan)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {order.status === "PENDING_PAYMENT" && (
              <>
                <Link href={`/payment/${order.id}/pending`}>
                  <Button size="sm" variant="primary">
                    Buka Halaman VA (Menunggu Bayar)
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => payOrder(order.id)}
                >
                  ⚡ Bayar Sekarang (Simulasi Lunas)
                </Button>
              </>
            )}

            {order.status === "FUNDED" && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setResiModalOpen(true)}
              >
                📦 Seller: Input Nomor Resi Pengiriman
              </Button>
            )}

            {order.status === "SHIPPED" && (
              <Button
                size="sm"
                variant="accent"
                onClick={() => simulateDelivered(order.id)}
              >
                🚚 Kurir: Simulasikan Paket Tiba (Mulai Inspeksi)
              </Button>
            )}

            {order.status === "INSPECTING" && (
              <>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => {
                    confirmOrderReceived(order.id);
                    setReviewModalOpen(true);
                  }}
                >
                  ✅ Konfirmasi Barang Sesuai (Cairkan Dana)
                </Button>
                <Link href={`/disputes/DSP-2026-88421`}>
                  <Button size="sm" variant="destructive">
                    ⚠️ Simulasi Ajukan Sengketa
                  </Button>
                </Link>
              </>
            )}

            {order.status === "COMPLETED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReviewModalOpen(true)}
              >
                ⭐ Beri / Lihat Ulasan
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Seller Input Resi Modal */}
      <Modal
        isOpen={resiModalOpen}
        onClose={() => setResiModalOpen(false)}
        title="Input Nomor Resi Pengiriman"
        description="Pastikan resi valid agar pembeli dapat melacak keberadaan paket."
      >
        <form onSubmit={handleShipSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-on-surface">Jasa Kurir</label>
            <Input
              value={courierInput}
              onChange={(e) => setCourierInput(e.target.value)}
              placeholder="Contoh: J&T Express VIP / JNE YES"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface">Nomor Resi (AWB)</label>
            <Input
              value={resiInput}
              onChange={(e) => setResiInput(e.target.value)}
              placeholder="Contoh: JT928174829102"
              className="mt-1 font-mono uppercase"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setResiModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Simpan & Kirim Paket
            </Button>
          </div>
        </form>
      </Modal>

      {/* Review Modal */}
      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        order={order}
      />
    </div>
  );
}

export default OrderTimeline;
