"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  Copy,
  Check,
  Clock,
  Battery,
  Camera,
  Fingerprint,
  Lock,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Truck,
  MapPin,
  HelpCircle,
  Star,
  Upload,
} from "lucide-react";
import { useOrderStore } from "@/stores/useOrderStore";
import { useDisputeStore } from "@/stores/useDisputeStore";
import { formatRupiah, copyTextToClipboard } from "@/lib/utils";
import type { Order } from "@/types";
import { useToast } from "@/components/ui/Toast";
import OrderTimeline from "@/components/features/OrderTimeline";
import ReviewModal from "@/components/features/ReviewModal";
import Modal from "@/components/ui/Modal";
import confetti from "canvas-confetti";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const {
    confirmOrderReceived,
    shipOrder,
    markAsDisputed,
  } = useOrderStore();
  const { createDispute } = useDisputeStore();
  const { showToast } = useToast();

  const [copiedResi, setCopiedResi] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  // Dispute form states
  const [disputeReason, setDisputeReason] = useState("ITEM_DEFECT");
  const [disputeNotes, setDisputeNotes] = useState("");
  const [disputeFile, setDisputeFile] = useState<string | null>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectionSeconds, setInspectionSeconds] = useState(0);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setError("FORBIDDEN: Anda tidak memiliki akses ke pesanan ini.");
          } else {
            setError("Gagal memuat pesanan.");
          }
          return;
        }
        const data = await res.json();
        setOrder(data);
        if (data.inspectionExpiresAt) {
          const diff = Math.floor((new Date(data.inspectionExpiresAt).getTime() - Date.now()) / 1000);
          setInspectionSeconds(diff > 0 ? diff : 0);
        }
      } catch {
        setError("Terjadi kesalahan sistem.");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  // Countdown timer dynamically calculated from order.inspectionExpiresAt

  // The initial countdown value is set when fetching the order

  useEffect(() => {
    if (!order?.inspectionExpiresAt) return;
    const timer = setInterval(() => {
      setInspectionSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [order?.inspectionExpiresAt]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="text-on-surface-variant font-medium text-sm animate-pulse">Memuat pesanan...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="bg-surface-container-lowest p-8 rounded-3xl text-center max-w-sm w-full border border-error/30 space-y-4">
          <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto text-error">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="font-bold text-lg text-error">Akses Ditolak / Gagal</h2>
          <p className="text-xs text-on-surface-variant">{error}</p>
          <Link
            href="/orders"
            className="block w-full py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold mt-4"
          >
            Kembali ke Daftar Pesanan
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="bg-surface-container-lowest p-8 rounded-3xl text-center max-w-sm w-full border border-outline-variant/30 space-y-4">
          <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto text-on-surface-variant">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h2 className="font-bold text-lg text-on-surface">Pesanan Tidak Ditemukan</h2>
          <p className="text-xs text-on-surface-variant">
            Pesanan dengan ID {orderId} belum tersedia atau telah dihapus.
          </p>
          <Link
            href="/orders"
            className="block w-full py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold"
          >
            Kembali ke Daftar Pesanan
          </Link>
        </div>
      </div>
    );
  }

  const days = Math.floor(inspectionSeconds / 86400);
  const hours = Math.floor((inspectionSeconds % 86400) / 3600);
  const mins = Math.floor((inspectionSeconds % 3600) / 60);
  const secs = inspectionSeconds % 60;

  const handleCopy = async (text: string, type: "order" | "resi") => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      if (type === "order") {
        setCopiedOrderId(true);
        setTimeout(() => setCopiedOrderId(false), 2000);
      } else {
        setCopiedResi(true);
        setTimeout(() => setCopiedResi(false), 2000);
      }
      showToast("Berhasil disalin ke clipboard", "success");
    }
  };

  const handleReleaseFunds = async () => {
    if (!order) return;
    if (
      window.confirm(
        `Konfirmasi barang sesuai & lepaskan dana ${formatRupiah(
          order.totalAmount
        )} ke penjual ${order.listing.seller.name}? Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      try {
        const res = await fetch(`/api/orders/${order.id}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toStatus: "COMPLETED",
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          showToast(errData.message || "Gagal melepaskan dana escrow.", "error");
          return;
        }

        confirmOrderReceived(order.id);
        setOrder((prev) => (prev ? { ...prev, status: "COMPLETED" as const } : null));
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
        });
        showToast(
          "Terima kasih! Dana telah berhasil dicairkan ke dompet penjual.",
          "success"
        );
        setShowReviewModal(true);
      } catch (err) {
        console.error("[OrderDetailPage] handleReleaseFunds failed:", err);
        showToast(
          "Status pencairan dana belum bisa dipastikan (koneksi terputus/timeout). Periksa status pesanan Anda.",
          "warning",
          "Status Pencairan Belum Dipastikan"
        );
      }
    }
  };

  const handleSubmitDispute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeNotes.trim()) {
      showToast("Harap jelaskan kendala atau minus unit", "error");
      return;
    }

    const dispute = createDispute({
      orderId: order.id,
      reason: disputeReason,
      notes: disputeNotes,
      evidencePhotos: disputeFile ? [disputeFile] : [],
    });

    markAsDisputed(order.id, dispute.id);
    setShowDisputeModal(false);
    showToast("Tiket sengketa berhasil dibuka. Dana dibekukan aman.", "warning");
    router.push(`/disputes/${dispute.id}`);
  };

  return (
    <div className="min-h-screen bg-surface pb-36 pt-4">
      <div className="max-w-xl mx-auto px-4 space-y-4">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between py-2">
          <button
            onClick={() => router.push("/orders")}
            className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center text-center">
            <h1 className="font-bold text-headline-sm text-on-surface">Lacak Status Escrow</h1>
            <div className="flex items-center gap-1 text-secondary font-bold text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Rekber Terlindungi</span>
            </div>
          </div>
          <Link
            href="/help/escrow"
            className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
          </Link>
        </div>

        {/* Status Sub-header Bar */}
        <div className="flex items-center justify-between gap-2 bg-surface-container-lowest px-4 py-2.5 rounded-2xl border border-outline-variant/30 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">
              No. Pesanan:
            </span>
            <button
              onClick={() => handleCopy(order.id, "order")}
              className="flex items-center gap-1 font-mono text-xs font-bold text-on-surface hover:text-primary"
            >
              <span>{order.id}</span>
              {copiedOrderId ? (
                <Check className="w-3 h-3 text-secondary" />
              ) : (
                <Copy className="w-3 h-3 text-on-surface-variant" />
              )}
            </button>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-xs font-bold text-primary shrink-0">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
            <span>
              {order.status === "PENDING_PAYMENT"
                ? "Menunggu Bayar"
                : order.status === "FUNDED"
                ? "Escrow Diamankan"
                : order.status === "SHIPPED"
                ? "Dalam Pengiriman"
                : order.status === "INSPECTING"
                ? "Masa Uji Aktif"
                : order.status === "COMPLETED"
                ? "Transaksi Selesai"
                : "Dalam Sengketa"}
            </span>
          </div>
        </div>

        {/* Primary State Hero Card */}
        {order.status === "INSPECTING" && (
          <div className="rounded-2xl p-4 bg-surface-container-high relative overflow-hidden border border-primary/20 shadow-xs space-y-3">
            <div className="flex items-start gap-3 relative z-10">
              <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-on-primary shrink-0 shadow-md">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    Tahap 4 dari 5 • Escrow Safe
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold">
                    2x24 Jam
                  </span>
                </div>
                <h2 className="font-bold text-sm text-on-surface mt-0.5">
                  Paket Tiba! Masa Inspeksi Dimulai
                </h2>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Dana <strong className="text-on-surface">{formatRupiah(order.totalAmount)}</strong> terkunci aman di rekening escrow. Silakan uji seluruh fungsi sebelum memberi izin pencairan.
                </p>
              </div>
            </div>

            {/* Countdown box */}
            <div className="rounded-xl p-3 bg-surface-container-lowest flex items-center justify-between shadow-xs border border-outline-variant/20">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-semibold text-on-surface-variant">
                    Sisa Waktu Uji Gadget
                  </span>
                  <span className="font-mono font-bold text-xs text-amber-700">
                    {String(days).padStart(2, "0")}h {String(hours).padStart(2, "0")}j{" "}
                    {String(mins).padStart(2, "0")}m {String(secs).padStart(2, "0")}d
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold gap-1">
                <Lock className="w-3 h-3" /> Escrow Hold
              </span>
            </div>

            {/* Micro checklist tips */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-on-surface-variant text-xs">
              <div className="flex items-center gap-1.5 bg-surface-container-lowest/80 px-2.5 py-1.5 rounded-lg">
                <Battery className="w-3.5 h-3.5 text-secondary" />
                <span>Baterai &amp; Health</span>
              </div>
              <div className="flex items-center gap-1.5 bg-surface-container-lowest/80 px-2.5 py-1.5 rounded-lg">
                <Camera className="w-3.5 h-3.5 text-secondary" />
                <span>Kamera &amp; Sensor</span>
              </div>
              <div className="flex items-center gap-1.5 bg-surface-container-lowest/80 px-2.5 py-1.5 rounded-lg">
                <Fingerprint className="w-3.5 h-3.5 text-secondary" />
                <span>Face/Touch ID</span>
              </div>
              <div className="flex items-center gap-1.5 bg-surface-container-lowest/80 px-2.5 py-1.5 rounded-lg">
                <Lock className="w-3.5 h-3.5 text-secondary" />
                <span>iCloud / Akun Kosong</span>
              </div>
            </div>
          </div>
        )}

        {order.status === "FUNDED" && (
          <div className="rounded-2xl p-4 bg-primary/10 border border-primary/20 space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Tahap 2 dari 5 • Dana Diamankan di Rekber</span>
            </div>
            <h3 className="font-bold text-sm text-on-surface">
              Pembayaran Terverifikasi! Menunggu Penjual Mengirim Paket
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Dana kamu sebesar <strong className="text-on-surface">{formatRupiah(order.totalAmount)}</strong> telah masuk ke rekening escrow penampung resmi. Penjual diinstruksikan segera mengirim barang dalam 2x24 jam.
            </p>
          </div>
        )}

        {order.status === "SHIPPED" && (
          <div className="rounded-2xl p-4 bg-blue-500/10 border border-blue-500/20 space-y-2">
            <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
              <Truck className="w-4 h-4" />
              <span>Tahap 3 dari 5 • Paket Dalam Perjalanan</span>
            </div>
            <h3 className="font-bold text-sm text-on-surface">
              Penjual Telah Mengirim Paket ke Kurir
            </h3>
            <div className="bg-surface-container-lowest p-2.5 rounded-xl border border-blue-500/20 flex items-center justify-between">
              <div className="text-xs">
                <span className="text-on-surface-variant">{order.courier} • </span>
                <span className="font-mono font-bold text-on-surface">
                  Resi: {order.trackingNumber || "JT9928174620"}
                </span>
              </div>
              <button
                onClick={() => handleCopy(order.trackingNumber || "JT9928174620", "resi")}
                className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
              >
                {copiedResi ? <Check className="w-3.5 h-3.5 text-secondary" /> : "Salin"}
              </button>
            </div>
          </div>
        )}

        {order.status === "COMPLETED" && (
          <div className="rounded-2xl p-4 bg-secondary-fixed/30 border border-secondary/20 space-y-2">
            <div className="flex items-center gap-2 text-secondary font-bold text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>Tahap 5 dari 5 • Transaksi Selesai Sukses</span>
            </div>
            <h3 className="font-bold text-sm text-on-surface">
              Dana Telah Diteruskan ke Penjual
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Terima kasih telah bertransaksi aman melalui garansi escrow NgeBekasinYuk. Komunitas secondhand tech semakin percaya berkat transaksi jujurmu!
            </p>
          </div>
        )}

        {order.status === "DISPUTED" && (
          <div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/20 space-y-2">
            <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              <span>Status Khusus • Tiket Sengketa Terbuka</span>
            </div>
            <h3 className="font-bold text-sm text-on-surface">
              Dana Transaksi Dibekukan Sementara di Rekening Escrow
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Tim mediator independen NgeBekasinYuk sedang memeriksa bukti unboxing dan keterangan dari kedua pihak.
            </p>
            <Link
              href={`/disputes/${order.disputeId || "DSP-2026-88421"}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline pt-1"
            >
              <span>Buka Ruang Mediasi &amp; Diskusi</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Escrow Pipeline Stepper Bar */}
        <div className="rounded-2xl p-3.5 bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-on-surface-variant">
              Panduan Alur Rekber
            </span>
            <span className="font-semibold text-primary">100% Bebas Penipuan</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center pt-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-full h-1.5 rounded-full ${
                  order.status !== "PENDING_PAYMENT" ? "bg-secondary" : "bg-surface-container-highest"
                }`}
              ></div>
              <span
                className={`text-[10px] font-semibold ${
                  order.status !== "PENDING_PAYMENT" ? "text-secondary" : "text-on-surface-variant"
                }`}
              >
                1. Funded
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-full h-1.5 rounded-full ${
                  order.status === "SHIPPED" ||
                  order.status === "INSPECTING" ||
                  order.status === "COMPLETED"
                    ? "bg-secondary"
                    : "bg-surface-container-highest"
                }`}
              ></div>
              <span
                className={`text-[10px] font-semibold ${
                  order.status === "SHIPPED" ||
                  order.status === "INSPECTING" ||
                  order.status === "COMPLETED"
                    ? "text-secondary"
                    : "text-on-surface-variant"
                }`}
              >
                2. Shipped
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-full h-1.5 rounded-full ${
                  order.status === "INSPECTING"
                    ? "bg-primary animate-pulse"
                    : order.status === "COMPLETED"
                    ? "bg-secondary"
                    : "bg-surface-container-highest"
                }`}
              ></div>
              <span
                className={`text-[10px] font-semibold ${
                  order.status === "INSPECTING"
                    ? "text-primary font-bold"
                    : order.status === "COMPLETED"
                    ? "text-secondary"
                    : "text-on-surface-variant"
                }`}
              >
                3. Inspecting
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-full h-1.5 rounded-full ${
                  order.status === "COMPLETED" ? "bg-secondary" : "bg-surface-container-highest"
                }`}
              ></div>
              <span
                className={`text-[10px] font-semibold ${
                  order.status === "COMPLETED" ? "text-secondary font-bold" : "text-on-surface-variant"
                }`}
              >
                4. Released
              </span>
            </div>
          </div>
        </div>

        {/* Gadget Summary Card */}
        <div className="rounded-2xl p-4 bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-3">
          {/* Seller Strip */}
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                {order.listing.seller.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs text-on-surface truncate">
                    {order.listing.seller.name}
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                </div>
                <span className="text-[11px] text-on-surface-variant">
                  {order.listing.seller.city} • Rating 4.9
                </span>
              </div>
            </div>
            <Link
              href={`/chat/c-dimas`}
              className="px-3 py-1.5 rounded-xl bg-surface-container-low text-primary text-xs font-bold flex items-center gap-1 hover:bg-surface-container transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </Link>
          </div>

          {/* Item Details */}
          <div className="flex gap-3 items-center">
            <div className="w-20 h-20 rounded-xl bg-surface-container overflow-hidden shrink-0 relative border border-outline-variant/20">
              <Image
                src={order.listing.images[0] || "/assets/products/ipad-mini-unboxing.png"}
                alt={order.listing.title}
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <h3 className="font-bold text-sm text-on-surface truncate">
                {order.listing.title}
              </h3>
              <div className="flex flex-wrap items-center gap-1">
                <span className="px-2 py-0.5 rounded bg-surface-container-low text-[10px] text-on-surface-variant font-medium">
                  {order.listing.condition}
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-low text-[10px] text-on-surface-variant font-medium">
                  Dus Lengkap
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-bold text-sm text-on-surface">
                  {formatRupiah(order.itemPrice)}
                </span>
                <span className="text-[10px] text-secondary font-bold">
                  Garansi Escrow 7 Hari
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Component */}
        <OrderTimeline order={order} />

        {/* Shipping Address & Escrow Financial Summary */}
        <div className="rounded-2xl p-4 bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-3">
          <h3 className="font-bold text-xs text-on-surface">Rincian Pengiriman &amp; Rekber</h3>
          <div className="flex items-start gap-2.5 bg-surface-container-low p-3 rounded-xl">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col text-xs min-w-0">
              <span className="font-bold text-on-surface">
                {order.buyerName} ({order.buyerPhone})
              </span>
              <span className="text-on-surface-variant mt-0.5 leading-relaxed">
                {order.shippingAddress}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-1 text-xs text-on-surface-variant">
            <div className="flex justify-between">
              <span>Harga Unit</span>
              <span className="text-on-surface font-semibold">
                {formatRupiah(order.itemPrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Ongkos Kirim ({order.courier})</span>
              <span className="text-on-surface font-semibold">
                {formatRupiah(order.shippingFee)}
              </span>
            </div>
            <div className="flex justify-between items-center text-secondary">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Biaya Escrow Rekber</span>
              </span>
              <span className="font-bold">GRATIS (Promo)</span>
            </div>
            <div className="h-px bg-outline-variant/20 my-1"></div>
            <div className="flex items-center justify-between text-sm font-bold text-on-surface">
              <span>Total Pembayaran Aman</span>
              <span className="text-primary text-base font-black">
                {formatRupiah(order.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Dev Simulation Controls */}
        <div className="rounded-2xl p-3.5 bg-surface-container-high border border-outline-variant/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-on-surface flex items-center gap-1">
              <span>⚡ Panel Simulasi Siklus Escrow (Dev Tools)</span>
            </span>
            <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded font-bold">
              Prototype Mode
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={async () => {
                await fetch(`/api/orders/${order.id}/transition`, {
                  method: "POST",
                  body: JSON.stringify({ toStatus: "SHIPPED", shippingCourier: "JT", shippingAirwayBill: "JT" + Math.floor(1000000000 + Math.random() * 9000000000) })
                });
                showToast("Simulasi: Penjual telah menginput resi kurir!", "info");
                // Refresh the page to load updated data from API
                window.location.reload();
              }}
              className="p-2 bg-surface-container-lowest text-on-surface hover:bg-surface-container rounded-xl font-bold border border-outline-variant/30 text-left flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>1. Simulasi Kirim Resi</span>
            </button>
            <button
              onClick={async () => {
                await fetch(`/api/orders/${order.id}/transition`, {
                  method: "POST",
                  body: JSON.stringify({ toStatus: "INSPECTING" })
                });
                showToast("Simulasi: Kurir konfirmasi paket telah tiba!", "success");
                window.location.reload();
              }}
              className="p-2 bg-surface-container-lowest text-on-surface hover:bg-surface-container rounded-xl font-bold border border-outline-variant/30 text-left flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>2. Simulasi Paket Tiba</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Contextual Action Panel */}
      <div className="fixed bottom-0 inset-x-0 bg-surface-container-lowest/95 backdrop-blur-xl p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border-t border-outline-variant/30 z-40">
        <div className="max-w-xl mx-auto space-y-2">
          <div className="flex items-center justify-between px-1 text-xs text-on-surface-variant">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
              <span>Dana dilindungi garansi rekber OJK &amp; BI</span>
            </div>
            <Link href="/help/escrow" className="font-semibold text-primary hover:underline">
              SOP Rekber
            </Link>
          </div>

          {order.status === "PENDING_PAYMENT" && (
            <Link
              href={`/payment/${order.id}/pending`}
              className="w-full h-11 bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-primary/90 transition-all"
            >
              Bayar Tagihan Sekarang
            </Link>
          )}

          {order.status === "INSPECTING" && (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setShowDisputeModal(true)}
                className="h-11 rounded-xl bg-surface-container-high text-error font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-error/10 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Ajukan Komplain</span>
              </button>
              <button
                onClick={handleReleaseFunds}
                className="h-11 rounded-xl bg-secondary text-on-secondary font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:bg-secondary/90 active:scale-98 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Lepas Dana</span>
              </button>
            </div>
          )}

          {order.status === "COMPLETED" && (
            <div className="flex gap-2">
              {!order.reviewGiven ? (
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="flex-1 h-11 bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:bg-primary/90"
                >
                  <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>Beri Ulasan Gadget</span>
                </button>
              ) : (
                <Link
                  href="/search"
                  className="flex-1 h-11 bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:bg-primary/90"
                >
                  Belanja Gadget Lainnya
                </Link>
              )}
            </div>
          )}

          {order.status === "DISPUTED" && (
            <Link
              href={`/disputes/${order.disputeId || "DSP-2026-88421"}`}
              className="w-full h-11 bg-red-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-red-700 transition-all"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Masuk ke Ruang Mediasi Sengketa</span>
            </Link>
          )}

          {order.status === "FUNDED" && (
            <button
              onClick={() => {
                shipOrder(order.id, "JT9928174620");
                showToast("Simulasi: Resi pengiriman dibuat!", "success");
              }}
              className="w-full h-11 bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-primary/90"
            >
              <Truck className="w-4 h-4" />
              <span>Simulasi Penjual Input Resi Pengiriman</span>
            </button>
          )}
        </div>
      </div>

      {/* Review Modal */}
      <ReviewModal
        isOpen={showReviewModal}
        order={order}
        onClose={() => setShowReviewModal(false)}
      />

      {/* Dispute Modal */}
      <Modal
        isOpen={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        title="Ajukan Komplain Transaksi Escrow"
      >
        <form onSubmit={handleSubmitDispute} className="space-y-4 text-xs">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Dengan mengajukan komplain, dana sebesar{" "}
              <strong>{formatRupiah(order.totalAmount)}</strong> akan dibekukan otomatis dan tidak akan cair ke penjual sampai mediasi selesai.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-on-surface">Kategori Kendala</label>
            <select
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ITEM_DEFECT">Fungsi / Fisik Rusak (Minus Berat)</option>
              <option value="NOT_AS_DESCRIBED">Spesifikasi Tidak Sesuai Deskripsi</option>
              <option value="WRONG_ITEM">Barang Salah Kirim / Paket Kosong</option>
              <option value="IMEI_BLOCKED">IMEI Terblokir / Tidak Terdaftar Kemenperin</option>
              <option value="ICLOUD_LOCKED">iCloud / Akun Belum Log Out</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-on-surface">Keterangan Detail Kerusakan</label>
            <textarea
              rows={4}
              value={disputeNotes}
              onChange={(e) => setDisputeNotes(e.target.value)}
              placeholder="Jelaskan secara rinci minus apa saja yang ditemukan saat unboxing dan pengujian..."
              className="w-full p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-on-surface">Upload Video Bukti Unboxing (Mock)</label>
            <div
              onClick={() => {
                setDisputeFile("video_unboxing_defect_gadget.mp4");
                showToast("File video unboxing terpilih", "info");
              }}
              className="border-2 border-dashed border-outline-variant/40 rounded-xl p-4 text-center cursor-pointer hover:border-primary transition-colors bg-surface-container-low/50"
            >
              <Upload className="w-6 h-6 text-on-surface-variant mx-auto mb-1" />
              {disputeFile ? (
                <span className="font-bold text-primary">{disputeFile}</span>
              ) : (
                <span className="text-on-surface-variant">Klik untuk upload rekaman video unboxing 360°</span>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowDisputeModal(false)}
              className="flex-1 py-2.5 bg-surface-container-high text-on-surface rounded-xl font-bold hover:bg-surface-container"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-xs"
            >
              Kirim Komplain
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
