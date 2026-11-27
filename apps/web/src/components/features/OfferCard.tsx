"use client";

import React, { useState } from "react";
import {
  Check,
  X,
  ArrowRight,
  Clock,
  Tag,
  CheckCircle2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import type { Offer, ProductListing } from "@/types";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface OfferCardProps {
  offer: Offer;
  listing: ProductListing;
  viewerId: string;
  nowMs?: number;
  isLatestForOffer?: boolean;
  hasActivePendingOffer?: boolean;
  isBusy?: boolean;
  onAccept?: (offerId: string) => Promise<void> | void;
  onReject?: (offerId: string) => Promise<void> | void;
  onCounter?: (offerId: string, amount: number) => Promise<void> | void;
  onBuyNegotiated?: (offer: Offer) => void;
  onAcceptCounterAsBuyer?: (amount: number) => Promise<void> | void;
}

export function OfferCard({
  offer,
  listing,
  viewerId,
  nowMs = 0,
  isLatestForOffer = true,
  hasActivePendingOffer = false,
  isBusy = false,
  onAccept,
  onReject,
  onCounter,
  onBuyNegotiated,
  onAcceptCounterAsBuyer,
}: OfferCardProps) {
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterInput, setCounterInput] = useState(
    String(
      Math.max(
        10000,
        Math.round(((offer.offerPrice + listing.price) / 2) / 1000) * 1000
      )
    )
  );
  const [counterError, setCounterError] = useState<string | null>(null);

  const isExpiredByClock =
    (offer.status === "PENDING" || offer.status === "ACCEPTED") &&
    nowMs > 0 &&
    nowMs > new Date(offer.expiresAt).getTime();
  const displayStatus = isExpiredByClock ? "EXPIRED" : offer.status;

  const isSeller = viewerId === offer.sellerId;
  const isBuyer = viewerId === offer.buyerId;
  const isListingActive = !listing.status || listing.status === "ACTIVE";

  const statusMeta: Record<
    Offer["status"],
    { label: string; bg: string; text: string }
  > = {
    PENDING: {
      label: "Menunggu Konfirmasi",
      bg: "bg-[#FFF4E0]",
      text: "text-[#B26A00]",
    },
    ACCEPTED: {
      label: "Penawaran Disetujui",
      bg: "bg-brand-secondary-light",
      text: "text-brand-secondary",
    },
    REJECTED: {
      label: "Penawaran Ditolak",
      bg: "bg-red-50",
      text: "text-brand-danger",
    },
    COUNTERED: {
      label: "Harga Tanding Penjual",
      bg: "bg-brand-primary-soft",
      text: "text-brand-primary",
    },
    EXPIRED: {
      label: "Penawaran Kadaluwarsa",
      bg: "bg-surface-subtle",
      text: "text-text-muted",
    },
    CONSUMED: {
      label: "Digunakan untuk Checkout",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
    },
  };

  const badge = statusMeta[displayStatus] ?? statusMeta.EXPIRED;

  const handleCounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCounterError(null);
    const trimmed = counterInput.trim();
    const parsed = trimmed.length > 0 ? Number(trimmed) : Number.NaN;
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setCounterError("Masukkan nominal bulat lebih dari Rp 0.");
      return;
    }
    if (parsed > listing.price) {
      setCounterError("Harga tanding tidak boleh melebihi harga iklan.");
      return;
    }
    if (onCounter) {
      await onCounter(offer.id, parsed);
      setCounterOpen(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm p-3.5 sm:p-4 max-w-sm w-full flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-surface-border">
        <div className="flex items-center gap-1.5 font-bold text-xs text-on-surface">
          <Tag className="w-3.5 h-3.5 text-brand-primary" />
          <span>Penawaran Harga</span>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-[11px] text-text-muted line-through block tabular-nums">
            {formatRupiah(offer.originalPrice)}
          </span>
          <span className="text-lg font-black text-brand-primary tabular-nums">
            {formatRupiah(offer.offerPrice)}
          </span>
        </div>
        <span className="text-[11px] font-bold bg-brand-secondary-light text-brand-secondary px-2 py-0.5 rounded-md">
          Hemat {offer.discountPercent}%
        </span>
      </div>

      {displayStatus === "COUNTERED" && offer.counterPrice != null && (
        <div className="p-2.5 rounded-xl bg-brand-primary-soft/50 border border-brand-primary/20 flex items-center justify-between gap-2 text-xs">
          <span className="text-text-secondary font-medium">
            Harga tanding penjual:
          </span>
          <span className="font-extrabold text-brand-primary tabular-nums">
            {formatRupiah(offer.counterPrice)}
          </span>
        </div>
      )}

      {(displayStatus === "PENDING" || displayStatus === "ACCEPTED") && (
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>
            Berlaku s/d{" "}
            {new Date(offer.expiresAt).toLocaleString("id-ID", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        </div>
      )}

      {/* Seller Actions on active PENDING offer */}
      {isLatestForOffer && displayStatus === "PENDING" && isSeller && (
        <div className="flex flex-col gap-2 pt-1">
          {!isListingActive ? (
            <div className="text-[11px] font-semibold text-text-muted bg-surface-subtle rounded-lg px-2.5 py-2">
              Barang sedang tidak aktif ({listing.status}); tindakan penawaran
              dinonaktifkan.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={isBusy}
                  onClick={() => onAccept?.(offer.id)}
                  className="flex-1 text-xs font-bold gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Terima</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => setCounterOpen((prev) => !prev)}
                  className="flex-1 text-xs font-bold gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tawar Balik</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => onReject?.(offer.id)}
                  className="text-xs font-bold text-brand-danger border-red-200 hover:bg-red-50 px-2.5"
                  aria-label="Tolak Penawaran"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              {counterOpen && (
                <form
                  onSubmit={handleCounterSubmit}
                  className="flex flex-col gap-1.5 pt-1 border-t border-surface-border"
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={listing.price}
                      value={counterInput}
                      onChange={(e) => setCounterInput(e.target.value)}
                      placeholder="Nominal harga tanding"
                      aria-label="Nominal harga tanding"
                      className="flex-1 h-9 px-2.5 rounded-lg bg-surface-subtle text-xs font-mono font-bold text-on-surface border border-surface-border outline-none focus:border-brand-primary"
                      required
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="primary"
                      disabled={isBusy}
                      aria-label="Kirim Harga Tanding"
                      className="h-9 text-xs font-bold px-3"
                    >
                      Kirim
                    </Button>
                  </div>
                  {counterError && (
                    <p className="text-[11px] font-semibold text-brand-danger">
                      {counterError}
                    </p>
                  )}
                </form>
              )}
            </>
          )}
        </div>
      )}

      {isLatestForOffer && displayStatus === "PENDING" && isBuyer && (
        <div className="text-[11px] font-semibold text-text-secondary bg-surface-subtle rounded-lg px-2.5 py-2">
          Penawaran terkirim. Menunggu keputusan penjual.
        </div>
      )}

      {/* Buyer CTA on accepted, unexpired offer */}
      {isLatestForOffer && displayStatus === "ACCEPTED" && isBuyer && (
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={isBusy || !isListingActive}
          onClick={() => onBuyNegotiated?.(offer)}
          className="w-full font-bold gap-1.5 shadow-sm disabled:opacity-60"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            {isListingActive
              ? "Beli Sekarang (Harga Nego)"
              : `Barang Tidak Tersedia (${listing.status})`}
          </span>
          {isListingActive && <ArrowRight className="w-3.5 h-3.5" />}
        </Button>
      )}

      {isLatestForOffer && displayStatus === "ACCEPTED" && isSeller && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-secondary bg-brand-secondary-light/60 rounded-lg px-2.5 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Harga nego aktif — menunggu pembeli melakukan checkout.</span>
        </div>
      )}

      {isLatestForOffer &&
        displayStatus === "COUNTERED" &&
        isBuyer &&
        offer.counterPrice != null &&
        onAcceptCounterAsBuyer && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isBusy || !isListingActive || hasActivePendingOffer}
            onClick={() => onAcceptCounterAsBuyer(offer.counterPrice!)}
            className="w-full text-xs font-bold gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            <span>
              {hasActivePendingOffer
                ? "Ada Penawaran Pending Lain"
                : `Ajukan Harga Penjual (${formatRupiah(offer.counterPrice)})`}
            </span>
          </Button>
        )}

      {displayStatus === "CONSUMED" && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Penawaran ini telah dipakai untuk membuat pesanan escrow.</span>
        </div>
      )}
    </div>
  );
}
