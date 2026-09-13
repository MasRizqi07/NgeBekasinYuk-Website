"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  MapPin,
  Truck,
  CreditCard,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { useCartStore, AVAILABLE_COURIERS } from "@/stores/useCartStore";
import { useUserStore } from "@/stores/useUserStore";
import { useOrderStore } from "@/stores/useOrderStore";
import { useListingStore } from "@/stores/useListingStore";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function CheckoutPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { items, selectedCourier, setSelectedCourier, clearCart } = useCartStore();
  const { user } = useUserStore();
  const { createOrder } = useOrderStore();
  const { listings } = useListingStore();

  // If cart is empty, fallback to demo item (e.g. iPad Air 5 or first listing)
  const activeListing =
    items.length > 0 ? items[0].listing : listings[1] || listings[0];
  const activePrice =
    items.length > 0 && items[0].negotiatedPrice
      ? items[0].negotiatedPrice
      : activeListing.price;

  type PaymentMethod = "BCA_VA" | "MANDIRI_VA" | "BRI_VA" | "BNI_VA" | "QRIS";
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BCA_VA");

  useEffect(() => {
    const saved = sessionStorage.getItem("checkout_paymentMethod") as PaymentMethod;
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaymentMethod(saved);
    }
  }, []);

  const handleSetPaymentMethod = (method: typeof paymentMethod) => {
    setPaymentMethod(method);
    sessionStorage.setItem("checkout_paymentMethod", method);
  };

  const address = user.addresses.find((a) => a.isDefault) || user.addresses[0];
  const shippingFee = selectedCourier.price;
  const escrowFee = 0; // Promo launching
  const totalAmount = activePrice + shippingFee + escrowFee;

  const handlePayEscrow = () => {
    const order = createOrder({
      listing: activeListing,
      itemPrice: activePrice,
      shippingFee,
      escrowFee,
      totalAmount,
      buyerName: user.name,
      buyerPhone: user.phone,
      shippingAddress: `${address.addressLine}, ${address.city} ${address.postalCode}`,
      courier: `${selectedCourier.name} ${selectedCourier.service}`,
      paymentMethod,
    });

    clearCart();
    showToast("Pesanan dibuat! Mengalihkan ke pembayaran...", "info");
    router.push(`/payment/${order.id}/pending`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6">
      {/* Escrow Trust Micro-Banner */}
      <div className="bg-linear-to-r from-brand-secondary-light via-surface-subtle to-brand-primary-soft/30 p-4 rounded-2xl border border-brand-secondary/30 shadow-xs flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-secondary text-white flex items-center justify-center shrink-0 shadow-sm">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="font-bold text-sm text-on-surface">Dana Aman Ditahan Rekber</h2>
            <span className="bg-brand-secondary text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              Proteksi 100%
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
            Dana baru dicairkan ke penjual setelah kamu menerima paket dan lulus masa inspeksi{" "}
            <strong>2x24 jam</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* 1. Alamat Pengiriman */}
          <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-primary" />
                <h3 className="font-bold text-sm text-on-surface">Alamat Pengiriman</h3>
              </div>
              <span className="text-[10px] font-bold bg-brand-primary-soft text-brand-primary px-2 py-0.5 rounded-md">
                Utama
              </span>
            </div>

            <div className="p-3.5 bg-surface-subtle rounded-xl flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-on-surface text-sm">{address.recipientName}</span>
                <span className="text-text-muted">• {address.phone}</span>
              </div>
              <p className="text-text-secondary leading-relaxed mt-0.5">
                {address.addressLine}, {address.city} {address.postalCode}
              </p>
              <div className="flex items-center gap-1 text-brand-secondary font-semibold text-[11px] mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Titik Pin Lokasi Akurat</span>
              </div>
            </div>
          </div>

          {/* 2. Rincian Barang & Penjual */}
          <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-surface-subtle">
                  <Image
                    src={activeListing.seller.avatar}
                    alt={activeListing.seller.name}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-on-surface">
                      {activeListing.seller.name}
                    </span>
                    <span className="text-[10px] font-bold bg-brand-secondary-light text-brand-secondary px-1.5 py-0.2 rounded">
                      KYC Aktif
                    </span>
                  </div>
                  <span className="text-[11px] text-text-muted">{activeListing.seller.location}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3.5 pt-1">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-surface-subtle shrink-0">
                <Image
                  src={activeListing.images[0] || "/assets/products/ipad-mini-unboxing.png"}
                  alt={activeListing.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold bg-surface-subtle text-text-muted px-1.5 py-0.5 rounded">
                  {activeListing.conditionLabel}
                </span>
                <h4 className="font-bold text-xs sm:text-sm text-on-surface truncate mt-1">
                  {activeListing.title}
                </h4>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="font-extrabold text-sm sm:text-base text-brand-primary tabular-nums">
                    {formatRupiah(activePrice)}
                  </span>
                  {activePrice < activeListing.price && (
                    <span className="text-[10px] font-bold text-[#B26A00] bg-[#FFF4E0] px-1.5 py-0.2 rounded">
                      Harga Nego
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Pilihan Jasa Pengiriman */}
          <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-brand-primary" />
              <h3 className="font-bold text-sm text-on-surface">Pilih Layanan Kurir</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {AVAILABLE_COURIERS.map((c) => {
                const isSelected = selectedCourier.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCourier(c)}
                    className={`p-3.5 rounded-xl border text-left flex items-start justify-between transition-all ${
                      isSelected
                        ? "border-brand-primary bg-brand-primary-soft/40 shadow-xs"
                        : "border-surface-border bg-white hover:bg-surface-subtle"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-on-surface">
                        <span>{c.name}</span>
                        <span className="text-text-muted font-normal">• {c.service}</span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5">{c.description}</p>
                      <span className="text-[10px] font-bold text-brand-secondary mt-1 block">
                        Estimasi {c.etd}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-xs text-brand-primary tabular-nums">
                        {formatRupiah(c.price)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Metode Pembayaran Rekber */}
          <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand-primary" />
              <h3 className="font-bold text-sm text-on-surface">Metode Pembayaran (Escrow)</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: "BCA_VA", label: "BCA VA", badge: "Auto Cek" },
                  { id: "MANDIRI_VA", label: "Mandiri VA", badge: "Auto Cek" },
                  { id: "BRI_VA", label: "BRI VA", badge: "Auto Cek" },
                  { id: "QRIS", label: "QRIS Instan", badge: "Bebas Biaya" },
                ] as const
              ).map((m) => {
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSetPaymentMethod(m.id)}
                    className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center transition-all ${
                      isSelected
                        ? "border-brand-primary bg-brand-primary-soft/60 text-brand-primary font-bold shadow-xs"
                        : "border-surface-border bg-white text-text-secondary hover:bg-surface-subtle font-medium"
                    }`}
                  >
                    <span className="text-xs">{m.label}</span>
                    <span className="text-[9px] text-brand-secondary font-bold mt-0.5">
                      {m.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Invoicing Summary (4 cols) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-4 sticky top-24">
          <h3 className="font-bold text-sm text-on-surface">Rincian Pembayaran</h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between text-text-secondary">
              <span>Harga Gadget</span>
              <span className="font-bold text-on-surface tabular-nums">
                {formatRupiah(activePrice)}
              </span>
            </div>

            <div className="flex justify-between text-text-secondary">
              <span>Ongkos Kirim ({selectedCourier.name})</span>
              <span className="font-bold text-on-surface tabular-nums">
                {formatRupiah(shippingFee)}
              </span>
            </div>

            <div className="flex justify-between text-text-secondary">
              <span className="flex items-center gap-1">
                <span>Biaya Penjaminan Escrow</span>
                <span className="text-[9px] bg-brand-secondary-light text-brand-secondary font-bold px-1 rounded">
                  PROMO
                </span>
              </span>
              <span className="font-bold text-brand-secondary">GRATIS</span>
            </div>

            <div className="border-t border-surface-border pt-2.5 flex justify-between font-extrabold text-base text-on-surface">
              <span>Total Tagihan</span>
              <span className="text-brand-primary tabular-nums">
                {formatRupiah(totalAmount)}
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={handlePayEscrow}
            className="w-full font-bold gap-2 shadow-lg"
          >
            <Lock className="w-4 h-4" />
            <span>Bayar dengan Escrow 🔒</span>
          </Button>

          <p className="text-[11px] text-text-muted text-center leading-relaxed">
            Dengan menekan tombol di atas, dana kamu akan diproteksi di rekening penampung resmi
            dan tidak akan dicairkan tanpa persetujuanmu.
          </p>
        </div>
      </div>
    </div>
  );
}
