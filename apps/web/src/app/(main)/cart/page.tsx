"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Trash2, ShoppingBag, ArrowRight, ShieldCheck, Lock } from "lucide-react";
import { useCartStore } from "@/stores/useCartStore";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export default function CartPage() {
  const { items, removeItem, getSubtotal, getTotalAmount } =
    useCartStore();

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full bg-surface-subtle flex items-center justify-center text-text-muted">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="font-extrabold text-xl text-on-surface">Keranjang Belanja Kosong</h2>
        <p className="text-xs text-text-secondary max-w-sm">
          Yuk cari gadget idamanmu dengan garansi pembayaran rekening bersama (Escrow) 100% aman.
        </p>
        <Link href="/search">
          <Button variant="primary" size="md" className="font-bold">
            Mulai Belanja Gadget
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-surface-border pb-4">
        <h1 className="font-extrabold text-xl sm:text-2xl text-on-surface">
          Keranjang Belanja Gadget
        </h1>
        <span className="text-xs font-bold text-brand-secondary flex items-center gap-1">
          <ShieldCheck className="w-4 h-4" />
          Proteksi Escrow Aktif
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cart Item List (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {items.map(({ listing, negotiatedPrice }) => {
            const displayPrice = negotiatedPrice || listing.price;
            return (
              <div
                key={listing.id}
                className="bg-white p-4 rounded-2xl border border-surface-border shadow-xs flex items-center gap-4"
              >
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-surface-subtle shrink-0">
                  <Image
                    src={listing.images[0] || "/assets/products/ipad-mini-unboxing.png"}
                    alt={listing.title}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold bg-surface-subtle text-text-muted px-2 py-0.5 rounded-full">
                    {listing.conditionLabel}
                  </span>
                  <h3 className="font-bold text-sm text-on-surface truncate mt-1">
                    {listing.title}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-extrabold text-base text-brand-primary tabular-nums">
                      {formatRupiah(displayPrice)}
                    </span>
                    {negotiatedPrice && (
                      <span className="text-[10px] font-bold text-[#B26A00] bg-[#FFF4E0] px-1.5 py-0.2 rounded">
                        Harga Nego
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-text-muted block mt-0.5">
                    Penjual: {listing.seller.name} ({listing.city})
                  </span>
                </div>

                <button
                  onClick={() => removeItem(listing.id)}
                  aria-label="Hapus item"
                  className="p-2 text-text-muted hover:text-brand-danger transition-colors rounded-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Order Summary (4 cols) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-4 sticky top-24">
          <h3 className="font-bold text-sm text-on-surface">Ringkasan Pesanan</h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-text-secondary">
              <span>Subtotal Gadget</span>
              <span className="font-bold text-on-surface tabular-nums">
                {formatRupiah(getSubtotal())}
              </span>
            </div>

            <div className="flex justify-between text-text-secondary">
              <span className="flex items-center gap-1">
                <span>Biaya Escrow Rekber</span>
                <span className="text-[9px] bg-brand-secondary-light text-brand-secondary font-bold px-1 rounded">
                  PROMO
                </span>
              </span>
              <span className="font-bold text-brand-secondary">GRATIS</span>
            </div>

            <div className="border-t border-surface-border pt-2 flex justify-between font-extrabold text-sm sm:text-base text-on-surface">
              <span>Total Estimasi</span>
              <span className="text-brand-primary tabular-nums">
                {formatRupiah(getTotalAmount())}
              </span>
            </div>
          </div>

          <Link href="/checkout">
            <Button variant="primary" size="lg" className="w-full font-bold gap-2">
              <span>Lanjut ke Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-muted text-center pt-1">
            <Lock className="w-3.5 h-3.5 text-brand-secondary" />
            <span>Dana ditahan aman sampai barang kamu terima & uji.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
