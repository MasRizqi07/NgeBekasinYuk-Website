"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Tag,
  Clock,
  XCircle,
  ArrowRight,
  Lock,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { Offer, ProductListing } from "@/types";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useChatStore } from "@/stores/useChatStore";
import { useCartStore } from "@/stores/useCartStore";

interface OfferCardProps {
  offer: Offer;
  listing: ProductListing;
  convoId: string;
}

export function OfferCard({ offer, listing, convoId }: OfferCardProps) {
  const { acceptOffer, rejectOffer, counterOffer } = useChatStore();
  const { addItem } = useCartStore();

  const [counterOpen, setCounterOpen] = useState(false);
  const [counterPrice, setCounterPrice] = useState(
    Math.round(offer.offerPrice * 1.05)
  );

  const handleCheckoutClick = () => {
    addItem(listing, offer.offerPrice);
  };

  const isAccepted = offer.status === "ACCEPTED";
  const isRejected = offer.status === "REJECTED";
  const isPending = offer.status === "PENDING";

  return (
    <div
      className={`w-full max-w-md my-3 rounded-2xl p-4 shadow-md flex flex-col gap-3 relative overflow-hidden border ${
        isAccepted
          ? "bg-brand-secondary-light border-brand-secondary/40"
          : isRejected
          ? "bg-brand-danger-soft border-brand-danger/30"
          : "bg-surface-subtle border-surface-border"
      }`}
    >
      {/* Top Border Accent Line */}
      <div
        className={`absolute top-0 inset-x-0 h-1.5 ${
          isAccepted
            ? "bg-brand-secondary"
            : isRejected
            ? "bg-brand-danger"
            : "bg-brand-primary"
        }`}
      />

      {/* Header Info */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm">
          {isAccepted ? (
            <div className="flex items-center gap-1 text-brand-secondary">
              <Sparkles className="w-4 h-4" />
              <span>Tawaran Disetujui Penjual!</span>
            </div>
          ) : isRejected ? (
            <div className="flex items-center gap-1 text-brand-danger">
              <XCircle className="w-4 h-4" />
              <span>Tawaran Ditolak</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-brand-primary">
              <Tag className="w-4 h-4" />
              <span>Penawaran Harga Diajukan</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] font-semibold text-text-muted bg-white/70 px-2 py-0.5 rounded-full shadow-xs">
          <Clock className="w-3 h-3 text-[#B26A00]" />
          <span>Berlaku 24 Jam</span>
        </div>
      </div>

      {/* Product Summary Row */}
      <div className="bg-white p-2.5 rounded-xl border border-surface-border flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-surface-subtle shrink-0">
          <Image
            src={listing.images[0] || "/assets/products/ipad-mini-unboxing.png"}
            alt={listing.title}
            fill
            sizes="48px"
            className="object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-xs text-on-surface truncate">
            {listing.title}
          </h4>
          <span className="text-[11px] text-text-muted">{listing.conditionLabel}</span>
        </div>
      </div>

      {/* Price Computation */}
      <div className="bg-white p-3 rounded-xl border border-surface-border flex flex-col gap-1.5 shadow-xs">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Harga Asli Listing:</span>
          <span className="line-through tabular-nums">
            {formatRupiah(offer.originalPrice)}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-surface-border">
          <span className="font-bold text-xs sm:text-sm text-on-surface">
            Harga Penawaran:
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold bg-brand-secondary-light text-brand-secondary px-1.5 py-0.5 rounded">
              Hemat {offer.discountPercent}%
            </span>
            <span
              className={`font-black text-base sm:text-lg tabular-nums ${
                isAccepted ? "text-brand-secondary" : "text-brand-primary"
              }`}
            >
              {formatRupiah(offer.offerPrice)}
            </span>
          </div>
        </div>
      </div>

      {/* Accepted State: Instant Checkout CTA */}
      {isAccepted && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-on-secondary-container leading-tight">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>
              Harga Rp {offer.offerPrice.toLocaleString("id-ID")} terkunci khusus untuk akunmu.
            </span>
          </div>

          <Link href="/checkout" onClick={handleCheckoutClick}>
            <Button
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-lg gap-2"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>Checkout {formatRupiah(offer.offerPrice)} Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>

          <p className="text-[10px] text-center text-text-muted">
            Dilindungi Rekber Resmi NgeBekasinYuk • Uang aman sampai paket diinspeksi.
          </p>
        </div>
      )}

      {/* Pending State: Seller Actions */}
      {isPending && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => rejectOffer(convoId, offer.id)}
            >
              Tolak
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCounterOpen(!counterOpen)}
            >
              Tawar Balik
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={() => acceptOffer(convoId, offer.id)}
            >
              Terima
            </Button>
          </div>

          {counterOpen && (
            <div className="p-3 bg-white rounded-xl border border-surface-border flex flex-col gap-2">
              <label className="text-xs font-bold text-on-surface">
                Masukkan Harga Tawaran Balik:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(Number(e.target.value))}
                  className="flex-1 px-3 py-1.5 bg-surface-subtle rounded-lg text-xs font-mono font-bold"
                />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    counterOffer(convoId, offer.id, counterPrice);
                    setCounterOpen(false);
                  }}
                >
                  Kirim
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
