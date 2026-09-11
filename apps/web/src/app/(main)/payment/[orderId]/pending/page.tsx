"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  HelpCircle,
  Copy,
  Clock,
  CheckCircle2,
  Lock,
  RotateCw,
  QrCode,
  Building2,
  ChevronDown,
  Info,
  Download,
  Smartphone,
  Laptop,
  CreditCard,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useOrderStore } from "@/stores/useOrderStore";
import { formatRupiah, copyTextToClipboard } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import confetti from "canvas-confetti";

export default function PendingPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const { getOrderById, payOrder } = useOrderStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"va" | "qris">("va");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(86340); // ~23h 59m

  const order = getOrderById(orderId) || {
    id: orderId || "STX-2026-0941",
    listing: {
      id: "seed-macbook-m1",
      slug: "macbook-air-m1-256gb-space-grey",
      title: "MacBook Air M1 256GB Space Grey (Mulus 99%)",
      price: 8450000,
      images: [
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBUdbwsUwn1HToCtAScn-lmpCkowk8hnz0zCAZ3cQUz5y2l2usZdI4YOshyu-eo6FVZLIOWV8uId8iPhzwUdcgGorjRKXwi1ZMfsMDyG-NBKYeeDu4eXGMN76AuqMjFvODzz4ocvtyKavtrVnXMsAPutfKjJW1A744y95mx61X9tJWrVsjoiqL_ABSeBf6wuSFDcIdQCxvHl3KL1MC2VUusioki6xCIvq0lBmHZpzaA_WybUwsbVHb3",
      ],
      seller: {
        id: "usr-dimas",
        name: "Dimas Aditya",
        city: "Jakarta Barat",
        isVerified: true,
      },
      condition: "LIKE_NEW",
    },
    itemPrice: 8450000,
    shippingFee: 22000,
    escrowFee: 0,
    totalAmount: 8472000,
    vaNumber: "8277 0812 3456 7890",
    courier: "J&T Express Regular",
    status: "PENDING_PAYMENT",
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const handleCopy = async (text: string, label: string, fieldId: string) => {
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedField(fieldId);
      showToast(`${label} berhasil disalin`, "success");
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  const handleSimulatePayment = () => {
    setIsSimulating(true);
    setTimeout(() => {
      payOrder(order.id);
      setIsSimulating(false);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      showToast("Pembayaran berhasil diverifikasi oleh sistem Escrow!", "success");
      setTimeout(() => {
        router.push(`/orders/${order.id}`);
      }, 1000);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-surface pb-32 pt-4">
      <div className="max-w-md mx-auto px-4 space-y-4">
        {/* Top Navigation */}
        <div className="flex items-center justify-between py-2">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center text-center">
            <h1 className="font-bold text-headline-sm text-on-surface">Menunggu Pembayaran</h1>
            <div className="flex items-center gap-1 text-secondary font-semibold text-xs">
              <Lock className="w-3.5 h-3.5" />
              <span>Escrow Safe Lock Active</span>
            </div>
          </div>
          <Link
            href="/help/escrow"
            className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
          </Link>
        </div>

        {/* Order Ticket Badge */}
        <div className="flex items-center justify-between bg-surface-container-lowest px-4 py-3 rounded-2xl border border-outline-variant/30 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-primary font-bold text-xs bg-primary/10 px-2 py-0.5 rounded-md">
              Order No
            </span>
            <span className="font-bold text-sm tracking-tight text-on-surface">{order.id}</span>
          </div>
          <button
            onClick={() => handleCopy(order.id, "Nomor pesanan", "orderId")}
            className="p-1.5 rounded-lg hover:bg-surface-container-low transition-colors text-primary flex items-center gap-1 text-xs font-semibold"
          >
            {copiedField === "orderId" ? (
              <span className="text-secondary flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Tersalin
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Copy className="w-3.5 h-3.5" /> Salin
              </span>
            )}
          </button>
        </div>

        {/* Urgency & Expiry Countdown Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-700">
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Selesaikan Pembayaran Dalam:
              </span>
            </div>
            <div className="flex items-center gap-1 font-bold text-amber-700 font-mono text-sm">
              <span className="bg-surface-container-lowest px-2 py-0.5 rounded shadow-xs">
                {String(hours).padStart(2, "0")}
              </span>
              <span>:</span>
              <span className="bg-surface-container-lowest px-2 py-0.5 rounded shadow-xs">
                {String(minutes).padStart(2, "0")}
              </span>
              <span>:</span>
              <span className="bg-surface-container-lowest px-2 py-0.5 rounded shadow-xs animate-pulse text-primary">
                {String(seconds).padStart(2, "0")}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2 text-amber-900/80 text-xs bg-surface-container-lowest/80 p-2.5 rounded-xl border border-amber-500/10">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Unit gadget dikunci sementara khusus untuk kamu. Jangan biarkan waktu habis agar transaksi tidak dibatalkan otomatis dan unit diperebutkan pembeli lain.
            </p>
          </div>
        </div>

        {/* Real-time Webhook Polling Status */}
        <div className="bg-primary-fixed/40 px-4 py-3 rounded-2xl flex items-center justify-between border border-primary/20">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-on-primary-fixed truncate">
                Menunggu sinyal pembayaran otomatis...
              </span>
              <span className="text-[11px] text-on-surface-variant truncate">
                Sistem memindai mutasi rekening escrow setiap detik
              </span>
            </div>
          </div>
          <RotateCw className="w-4 h-4 text-primary animate-spin shrink-0" />
        </div>

        {/* Method Segmented Controls (VA vs QRIS) */}
        <div className="grid grid-cols-2 p-1 bg-surface-container-low rounded-xl border border-outline-variant/30">
          <button
            onClick={() => setActiveTab("va")}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "va"
                ? "bg-surface-container-lowest text-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Virtual Account</span>
          </button>
          <button
            onClick={() => setActiveTab("qris")}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "qris"
                ? "bg-surface-container-lowest text-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QRIS Instan</span>
          </button>
        </div>

        {/* Virtual Account Section */}
        {activeTab === "va" && (
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-14 bg-surface-container-high flex items-center justify-center rounded-lg font-black text-primary text-base tracking-tighter">
                  BCA
                </div>
                <div>
                  <div className="font-bold text-sm text-on-surface">BCA Virtual Account</div>
                  <div className="text-xs text-on-surface-variant">PT Bank Central Asia Tbk</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold flex items-center gap-1">
                <span>Auto 24 Jam</span>
              </span>
            </div>

            {/* VA Number Copy Box */}
            <div className="bg-surface-container-low p-3.5 rounded-xl space-y-1.5 border border-outline-variant/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant">
                  Nomor Virtual Account
                </span>
                <span className="text-xs text-secondary font-semibold">Bebas Biaya Admin</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-base font-black tracking-wider text-on-surface">
                  {order.vaNumber || "8277 0812 3456 7890"}
                </span>
                <button
                  onClick={() =>
                    handleCopy(
                      (order.vaNumber || "8277081234567890").replace(/\s/g, ""),
                      "Nomor VA",
                      "vaNum"
                    )
                  }
                  className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors shadow-xs flex items-center gap-1 shrink-0"
                >
                  {copiedField === "vaNum" ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Salin
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Total Payment Box */}
            <div className="bg-surface-container-low p-3.5 rounded-xl space-y-1.5 border border-outline-variant/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant">
                  Total Tagihan Pembayaran
                </span>
                <span className="text-xs text-amber-700 font-bold">Transfer Tepat</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-lg text-primary tabular-nums">
                  {formatRupiah(order.totalAmount)}
                </span>
                <button
                  onClick={() =>
                    handleCopy(order.totalAmount.toString(), "Nominal transfer", "amount")
                  }
                  className="px-3 py-1.5 bg-surface-container-highest text-primary rounded-lg text-xs font-bold hover:bg-surface-container-high transition-colors flex items-center gap-1 shrink-0"
                >
                  {copiedField === "amount" ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Salin
                    </>
                  )}
                </button>
              </div>

              {/* Breakdown Toggle */}
              <details className="pt-2 group text-xs">
                <summary className="font-semibold text-primary cursor-pointer list-none flex items-center gap-1">
                  <span>Rincian Tagihan Belanja</span>
                  <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="pt-2.5 space-y-1.5 text-on-surface-variant">
                  <div className="flex justify-between">
                    <span>Harga Gadget ({order.listing.title.slice(0, 24)}...)</span>
                    <span className="text-on-surface font-medium">
                      {formatRupiah(order.itemPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ongkos Kirim & Proteksi ({order.courier})</span>
                    <span className="text-on-surface font-medium">
                      {formatRupiah(order.shippingFee)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <span>Biaya Penjaminan Escrow</span>
                      <span className="text-secondary font-bold text-[10px] bg-secondary-fixed/50 px-1.5 rounded">
                        PROMO
                      </span>
                    </span>
                    <span className="text-secondary font-bold">GRATIS</span>
                  </div>
                </div>
              </details>
            </div>

            <div className="flex items-center gap-1.5 text-on-surface-variant text-xs">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span>Pastikan transfer tepat sesuai nominal untuk verifikasi instan.</span>
            </div>
          </div>
        )}

        {/* QRIS Section */}
        {activeTab === "qris" && (
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col items-center text-center space-y-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <div className="px-2 py-0.5 bg-red-600 text-white font-black text-xs rounded tracking-widest">
                  QRIS
                </div>
                <span className="font-semibold text-xs text-on-surface">
                  Standar Pembayaran Nasional
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
                Instan
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border-2 border-primary/20 shadow-sm flex flex-col items-center">
              <svg
                className="w-44 h-44"
                fill="none"
                viewBox="0 0 160 160"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect fill="white" height="160" rx="8" width="160"></rect>
                <rect fill="#0055c9" height="40" rx="4" width="40" x="12" y="12"></rect>
                <rect fill="white" height="28" rx="2" width="28" x="18" y="18"></rect>
                <rect fill="#0055c9" height="16" rx="2" width="16" x="24" y="24"></rect>
                <rect fill="#0055c9" height="40" rx="4" width="40" x="108" y="12"></rect>
                <rect fill="white" height="28" rx="2" width="28" x="114" y="18"></rect>
                <rect fill="#0055c9" height="16" rx="2" width="16" x="120" y="24"></rect>
                <rect fill="#0055c9" height="40" rx="4" width="40" x="12" y="108"></rect>
                <rect fill="white" height="28" rx="2" width="28" x="18" y="114"></rect>
                <rect fill="#0055c9" height="16" rx="2" width="16" x="24" y="120"></rect>
                <rect fill="#191c22" height="8" width="8" x="60" y="16"></rect>
                <rect fill="#191c22" height="8" width="8" x="76" y="16"></rect>
                <rect fill="#191c22" height="8" width="8" x="68" y="28"></rect>
                <rect fill="#191c22" height="8" width="8" x="88" y="28"></rect>
                <rect fill="#191c22" height="8" width="8" x="60" y="44"></rect>
                <rect fill="#191c22" height="8" width="8" x="76" y="44"></rect>
                <rect fill="#191c22" height="8" width="8" x="16" y="64"></rect>
                <rect fill="#191c22" height="8" width="8" x="32" y="64"></rect>
                <rect fill="#191c22" height="8" width="8" x="48" y="64"></rect>
                <rect fill="#191c22" height="8" width="8" x="64" y="64"></rect>
                <rect fill="#191c22" height="8" width="8" x="80" y="64"></rect>
                <rect fill="#191c22" height="8" width="8" x="104" y="64"></rect>
                <rect fill="#191c22" height="8" width="8" x="128" y="64"></rect>
                <rect fill="#0055c9" height="36" rx="8" width="36" x="62" y="62"></rect>
                <path
                  d="M80 70L89 74V81C89 86.5 85.2 91.5 80 93C74.8 91.5 71 86.5 71 81V74L80 70Z"
                  fill="white"
                ></path>
                <path
                  d="M76 81L79 84L85 77"
                  stroke="#006c4b"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                ></path>
                <rect fill="#191c22" height="8" width="8" x="16" y="84"></rect>
                <rect fill="#191c22" height="8" width="8" x="32" y="92"></rect>
                <rect fill="#191c22" height="8" width="8" x="48" y="84"></rect>
                <rect fill="#191c22" height="8" width="8" x="104" y="84"></rect>
                <rect fill="#191c22" height="8" width="8" x="128" y="92"></rect>
                <rect fill="#191c22" height="8" width="8" x="60" y="108"></rect>
                <rect fill="#191c22" height="8" width="8" x="76" y="108"></rect>
                <rect fill="#191c22" height="8" width="8" x="68" y="124"></rect>
                <rect fill="#191c22" height="8" width="8" x="92" y="124"></rect>
                <rect fill="#191c22" height="8" width="8" x="112" y="112"></rect>
                <rect fill="#191c22" height="8" width="8" x="132" y="128"></rect>
                <rect fill="#191c22" height="8" width="8" x="124" y="140"></rect>
                <rect fill="#191c22" height="8" width="8" x="140" y="140"></rect>
              </svg>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-base text-on-surface">
                {formatRupiah(order.totalAmount)}
              </span>
              <p className="text-xs text-on-surface-variant">
                Pindai QR ini via BCA Mobile, GoPay, OVO, ShopeePay, atau DANA
              </p>
            </div>

            <button
              onClick={() => showToast("Kode QR berhasil diunduh ke galeri", "success")}
              className="w-full py-2.5 bg-surface-container-high text-primary rounded-xl text-xs font-bold hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Kode QR</span>
            </button>
          </div>
        )}

        {/* Order Item Preview */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-on-surface">Ringkasan Unit Pesanan</span>
            <span className="text-xs text-secondary bg-secondary-fixed/30 px-2 py-0.5 rounded-full font-semibold">
              Ready to Escrow
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-surface-container shrink-0 relative">
              <Image
                src={order.listing.images[0] || "/assets/products/ipad-mini-unboxing.png"}
                alt={order.listing.title}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-bold text-sm text-on-surface truncate">
                {order.listing.title}
              </span>
              <div className="flex items-center gap-1 text-xs text-on-surface-variant mt-0.5">
                <span>Penjual: {order.listing.seller.name}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-on-surface-variant">
                <span className="px-1.5 py-0.5 bg-surface-container rounded">
                  {order.listing.condition === "BRAND_NEW_SEALED"
                    ? "Segel Baru"
                    : order.listing.condition === "LIKE_NEW"
                    ? "Mulus 99%"
                    : "Secondhand"}
                </span>
                <span className="px-1.5 py-0.5 bg-surface-container rounded">{order.courier}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Guide Accordion */}
        <div className="space-y-2">
          <div className="font-bold text-xs text-on-surface px-1">Panduan Pembayaran</div>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs divide-y divide-outline-variant/20 overflow-hidden">
            {/* Guide 1 */}
            <details className="group p-4 cursor-pointer">
              <summary className="flex items-center justify-between list-none text-xs font-bold text-on-surface">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" />
                  <span>Cara Bayar via m-BCA (BCA Mobile)</span>
                </div>
                <ChevronDown className="w-4 h-4 text-on-surface-variant group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-3 pl-6 space-y-2 text-xs text-on-surface-variant leading-relaxed">
                <div className="flex gap-2 items-start">
                  <span className="w-4 h-4 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary text-[10px] shrink-0">
                    1
                  </span>
                  <span>
                    Buka aplikasi m-BCA, pilih menu <strong>m-Transfer</strong> &gt;{" "}
                    <strong>BCA Virtual Account</strong>.
                  </span>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="w-4 h-4 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary text-[10px] shrink-0">
                    2
                  </span>
                  <span>
                    Masukkan nomor Virtual Account:{" "}
                    <strong className="text-on-surface font-mono">
                      {(order.vaNumber || "8277081234567890").replace(/\s/g, "")}
                    </strong>{" "}
                    lalu tap <strong>Send</strong>.
                  </span>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="w-4 h-4 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary text-[10px] shrink-0">
                    3
                  </span>
                  <span>
                    Periksa nama akun <strong>NGEBEKASIN - {order.listing.seller.name.toUpperCase()}</strong> dan
                    nominal transfer. Masukkan PIN m-BCA untuk konfirmasi.
                  </span>
                </div>
              </div>
            </details>

            {/* Guide 2 */}
            <details className="group p-4 cursor-pointer">
              <summary className="flex items-center justify-between list-none text-xs font-bold text-on-surface">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-primary" />
                  <span>Cara Bayar via KlikBCA (Internet Banking)</span>
                </div>
                <ChevronDown className="w-4 h-4 text-on-surface-variant group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-3 pl-6 space-y-2 text-xs text-on-surface-variant leading-relaxed">
                <div className="flex gap-2 items-start">
                  <span className="w-4 h-4 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary text-[10px] shrink-0">
                    1
                  </span>
                  <span>
                    Login ke KlikBCA, pilih menu <strong>Transfer Dana</strong> &gt;{" "}
                    <strong>Transfer ke BCA Virtual Account</strong>.
                  </span>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="w-4 h-4 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary text-[10px] shrink-0">
                    2
                  </span>
                  <span>Masukkan nomor VA dan respon KeyBCA Appli 1 lalu konfirmasi.</span>
                </div>
              </div>
            </details>

            {/* Guide 3 */}
            <details className="group p-4 cursor-pointer">
              <summary className="flex items-center justify-between list-none text-xs font-bold text-on-surface">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <span>Cara Bayar via Mesin ATM BCA</span>
                </div>
                <ChevronDown className="w-4 h-4 text-on-surface-variant group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-3 pl-6 space-y-2 text-xs text-on-surface-variant leading-relaxed">
                <div className="flex gap-2 items-start">
                  <span className="w-4 h-4 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary text-[10px] shrink-0">
                    1
                  </span>
                  <span>
                    Masukkan Kartu ATM &amp; PIN. Pilih <strong>Transaksi Lainnya</strong> &gt;{" "}
                    <strong>Transfer ke BCA Virtual Account</strong>.
                  </span>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Escrow Custodian Guarantee Seal */}
        <div className="text-center pt-2">
          <div className="inline-flex items-center gap-1.5 text-on-surface-variant text-xs">
            <ShieldCheck className="w-4 h-4 text-secondary" />
            <span>Dana Anda ditampung di Rekening Kustodian Resmi Terdaftar OJK &amp; BI</span>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action Dock */}
      <div className="fixed bottom-0 inset-x-0 bg-surface-container-lowest/95 backdrop-blur-xl p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] border-t border-outline-variant/30 z-40">
        <div className="max-w-md mx-auto space-y-2">
          <button
            onClick={handleSimulatePayment}
            disabled={isSimulating}
            className="w-full h-12 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-[0_4px_16px_0_rgba(15,111,255,0.32)] active:scale-[0.98] disabled:opacity-75"
          >
            <RotateCw className={`w-4 h-4 ${isSimulating ? "animate-spin" : ""}`} />
            <span>{isSimulating ? "Memverifikasi Mutasi Bank..." : "⚡ Simulasi Bayar Sekarang"}</span>
          </button>
          <div className="flex items-center justify-between px-2">
            <Link
              href="/checkout"
              className="text-xs text-on-surface-variant hover:text-primary font-semibold py-1"
            >
              Ubah Metode Bayar
            </Link>
            <Link
              href={`/orders/${order.id}`}
              className="text-xs text-on-surface-variant hover:text-primary font-semibold py-1"
            >
              Lihat Rincian Pesanan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
