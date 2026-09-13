"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  Star,
  Clock,
  Eye,
  MessageSquare,
  ShoppingBag,
  Lock,
  ChevronLeft,
  Share2,
  Heart,
  Tag,
} from "lucide-react";
import { useListingStore } from "@/stores/useListingStore";
import { useCartStore } from "@/stores/useCartStore";
import { useUserStore } from "@/stores/useUserStore";
import { useChatStore } from "@/stores/useChatStore";
import { formatRupiah, copyTextToClipboard } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { showToast } = useToast();

  const { listings } = useListingStore();
  const { addItem } = useCartStore();
  const { user, toggleFavorite } = useUserStore();
  const { sendOffer } = useChatStore();

  const listing = listings.find((item) => item.slug === slug) || listings[0];
  const isFavorite = user.favorites.includes(listing?.id || "");

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [negoModalOpen, setNegoModalOpen] = useState(false);
  const [negoPrice, setNegoPrice] = useState(
    Math.round(listing.price * 0.9)
  );

  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <h2 className="text-xl font-bold">Produk tidak ditemukan</h2>
        <Link href="/" className="text-brand-primary underline mt-2 inline-block">
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  const handleBuyNow = () => {
    addItem(listing);
    router.push("/checkout");
  };

  const handleNegoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendOffer("convo-dimas-ipad", negoPrice);
    setNegoModalOpen(false);
    showToast(
      `Tawaran ${formatRupiah(negoPrice)} berhasil dikirim ke penjual!`,
      "success"
    );
    router.push("/chat/convo-dimas-ipad");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 flex flex-col gap-6 pb-28 sm:pb-12">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-on-surface"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              copyTextToClipboard(window.location.href);
              showToast("Link produk berhasil disalin!", "info");
            }}
            className="w-9 h-9 rounded-xl border border-surface-border bg-white flex items-center justify-center text-text-muted hover:text-on-surface hover:bg-surface-subtle"
            title="Bagikan"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => toggleFavorite(listing.id)}
            className="w-9 h-9 rounded-xl border border-surface-border bg-white flex items-center justify-center text-text-muted hover:text-brand-danger hover:bg-surface-subtle"
            title="Simpan Favorit"
          >
            <Heart
              className={`w-4 h-4 ${
                isFavorite ? "fill-brand-danger text-brand-danger" : ""
              }`}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column: Photo Gallery (5 cols on lg) */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          {/* Main Photo View */}
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-surface-subtle border border-surface-border shadow-sm">
            <Image
              src={listing.images[activePhotoIdx] || listing.images[0]}
              alt={listing.title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              className="object-cover"
            />
            {/* Overlay: Condition Tag */}
            <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-full shadow-xs">
              {listing.conditionLabel}
            </div>

            {/* Diagnostic Passed Badge */}
            {listing.diagnosticPassed && (
              <div className="absolute top-3 right-3 bg-brand-secondary text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{listing.diagnosticTool || "Lolos Uji Diagnosa"}</span>
              </div>
            )}
          </div>

          {/* Thumbnails Row */}
          {listing.images.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
              {listing.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhotoIdx(idx)}
                  className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                    activePhotoIdx === idx
                      ? "border-brand-primary ring-2 ring-brand-primary/20 scale-105"
                      : "border-surface-border opacity-70 hover:opacity-100"
                  }`}
                >
                  <Image src={img} alt={`Thumbnail ${idx + 1}`} fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Details & Specs (6 cols on lg) */}
        <div className="lg:col-span-6 flex flex-col gap-5">
          {/* Pricing & Title Box */}
          <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-baseline gap-1">
                <span className="font-extrabold text-2xl sm:text-3xl text-brand-primary tabular-nums">
                  {formatRupiah(listing.price)}
                </span>
                {listing.originalPrice && (
                  <span className="text-xs text-text-muted line-through tabular-nums ml-1">
                    {formatRupiah(listing.originalPrice)}
                  </span>
                )}
              </div>

              {listing.canNego && (
                <button
                  onClick={() => setNegoModalOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-[#FFF4E0] hover:bg-[#FFE8BF] text-[#B26A00] font-bold text-xs px-3 py-1.5 rounded-full transition-colors active:scale-95"
                >
                  <Tag className="w-3.5 h-3.5 text-brand-accent" />
                  <span>Bisa Nego Santai</span>
                </button>
              )}
            </div>

            <h1 className="font-bold text-lg sm:text-xl text-on-surface leading-snug">
              {listing.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted pt-1 border-t border-surface-border">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Diposting baru saja
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {listing.viewsCount} tayangan
              </span>
              <span className="flex items-center gap-1 text-brand-secondary font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Garansi Rekber Resmi
              </span>
            </div>
          </div>

          {/* 100% Proteksi Escrow Rekber Box */}
          <div className="bg-linear-to-br from-white via-surface-subtle to-brand-primary-soft/30 p-5 rounded-2xl border border-brand-primary/20 shadow-xs flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-primary text-white flex items-center justify-center shrink-0 shadow-sm">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm text-on-surface">
                    100% Proteksi Rekber Escrow
                  </h3>
                  <span className="text-[10px] bg-brand-secondary text-white font-bold px-1.5 py-0.2 rounded-full">
                    Resmi
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  Uangmu disimpan aman di rekening penampung bersama NgeBekasinYuk sampai kamu terima
                  paket, cek fisik layar, dan uji fungsi <strong>2x24 jam</strong>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-surface-border text-center text-xs">
              <div>
                <div className="w-5 h-5 rounded-full bg-brand-primary text-white mx-auto flex items-center justify-center text-[11px] font-bold mb-1">
                  1
                </div>
                <span className="font-bold text-on-surface text-[11px]">Bayar Escrow</span>
                <p className="text-[10px] text-text-muted mt-0.5">Dana diamankan sistem</p>
              </div>

              <div>
                <div className="w-5 h-5 rounded-full bg-brand-secondary text-white mx-auto flex items-center justify-center text-[11px] font-bold mb-1">
                  2
                </div>
                <span className="font-bold text-brand-secondary text-[11px]">Uji 48 Jam</span>
                <p className="text-[10px] text-text-muted mt-0.5">Tes fungsi sepuasnya</p>
              </div>

              <div>
                <div className="w-5 h-5 rounded-full bg-brand-accent text-white mx-auto flex items-center justify-center text-[11px] font-bold mb-1">
                  3
                </div>
                <span className="font-bold text-on-surface text-[11px]">Puas? Selesai</span>
                <p className="text-[10px] text-text-muted mt-0.5">Dana diteruskan ke seller</p>
              </div>
            </div>
          </div>

          {/* Specifications Table */}
          <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-3">
            <h3 className="font-bold text-sm text-on-surface">Spesifikasi & Kondisi Detail</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(listing.specifications).map(([key, val]) => (
                <div key={key} className="bg-surface-subtle p-2.5 rounded-xl flex flex-col">
                  <span className="text-[11px] text-text-muted">{key}</span>
                  <span className="font-bold text-on-surface mt-0.5">{val}</span>
                </div>
              ))}
            </div>

            {/* Completeness Checklist */}
            <div className="pt-2 border-t border-surface-border">
              <span className="text-xs font-bold text-on-surface block mb-2">
                Kelengkapan Bawaan:
              </span>
              <div className="flex flex-wrap gap-2">
                {listing.completeness.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-surface-subtle text-text-secondary text-xs font-medium px-2.5 py-1 rounded-lg"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-secondary" />
                    <span>{item}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Description Text */}
            <div className="pt-2 border-t border-surface-border">
              <span className="text-xs font-bold text-on-surface block mb-1.5">
                Catatan Penjual:
              </span>
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
                {listing.description}
              </p>
            </div>
          </div>

          {/* Seller Card */}
          <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-surface-subtle shrink-0">
                <Image
                  src={listing.seller.avatar}
                  alt={listing.seller.name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm text-on-surface truncate">
                    {listing.seller.name}
                  </h4>
                  {listing.seller.verifiedKYC && (
                    <span className="bg-brand-secondary-light text-brand-secondary text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      KYC
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                  <span className="flex items-center gap-0.5 font-bold text-[#B26A00]">
                    <Star className="w-3.5 h-3.5 fill-brand-warning text-brand-warning" />
                    {listing.seller.rating} ({listing.seller.reviewCount})
                  </span>
                  <span>•</span>
                  <span>{listing.seller.location}</span>
                </div>
              </div>
            </div>

            <Link href="/chat/convo-dimas-ipad">
              <Button variant="outline" size="sm" className="shrink-0 gap-1 font-semibold">
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Dock (Fixed on Mobile, Clean floating bar on Desktop) */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-surface-border p-3 sm:py-4 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="hidden sm:flex flex-col">
            <span className="text-xs text-text-muted">Total Harga Unit</span>
            <span className="font-black text-xl text-brand-primary tabular-nums">
              {formatRupiah(listing.price)}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Link href="/chat/convo-dimas-ipad" className="flex-1 sm:flex-none">
              <Button variant="outline" size="md" className="w-full gap-1.5 font-bold">
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </Button>
            </Link>

            {listing.canNego && (
              <Button
                variant="secondary"
                size="md"
                className="flex-1 sm:flex-none gap-1.5 font-bold"
                onClick={() => setNegoModalOpen(true)}
              >
                <Tag className="w-4 h-4" />
                <span>Tawar Harga</span>
              </Button>
            )}

            <Button
              variant="primary"
              size="md"
              className="flex-1 sm:flex-none gap-1.5 font-bold shadow-lg"
              onClick={handleBuyNow}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Beli Sekarang (Escrow)</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Tawar Harga Drawer / Modal */}
      <Modal
        isOpen={negoModalOpen}
        onClose={() => setNegoModalOpen(false)}
        title="Ajukan Penawaran Harga 🏷️"
        description="Jika penjual menyetujui, harga akan terkunci selama 2 jam khusus untukmu."
      >
        <form onSubmit={handleNegoSubmit} className="flex flex-col gap-4">
          <div className="p-3 bg-surface-subtle rounded-xl flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white shrink-0">
              <Image src={listing.images[0]} alt={listing.title} fill sizes="48px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs text-on-surface truncate">{listing.title}</h4>
              <span className="text-xs text-text-muted">
                Harga Listing: <strong className="text-on-surface">{formatRupiah(listing.price)}</strong>
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface block mb-1">
              Harga Tawaran Kamu (Rp):
            </label>
            <input
              type="number"
              value={negoPrice}
              onChange={(e) => setNegoPrice(Number(e.target.value))}
              min={10000}
              max={listing.price}
              className="w-full h-11 px-3 bg-surface-subtle rounded-xl text-base font-mono font-bold text-on-surface outline-none border border-transparent focus:border-brand-primary focus:bg-white"
              required
            />
          </div>

          {/* Quick Discount Presets */}
          <div className="flex items-center gap-2">
            {[0.95, 0.9, 0.85].map((rate) => {
              const val = Math.round(listing.price * rate);
              return (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setNegoPrice(val)}
                  className="flex-1 py-1.5 rounded-lg bg-surface-subtle text-xs font-semibold text-text-secondary hover:bg-outline-variant transition-colors"
                >
                  -{(100 - rate * 100).toFixed(0)}% ({formatRupiah(val)})
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNegoModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Kirim Penawaran ke Chat
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
