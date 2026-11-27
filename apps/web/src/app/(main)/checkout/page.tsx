"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin,
  Truck,
  CreditCard,
  Lock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { Offer } from "@/types";
import { useCartStore, AVAILABLE_COURIERS } from "@/stores/useCartStore";
import { useUserStore } from "@/stores/useUserStore";
import { useResolvedCartListings } from "@/hooks/useResolvedCartListings";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetListingId = searchParams.get("listingId");
  const { showToast } = useToast();
  const { items, selectedCourier, setSelectedCourier, removeItem, addItem } =
    useCartStore();
  const { user, addAddress, syncSession } = useUserStore();
  const { listings, isLoading, droppedNotice } = useResolvedCartListings({
    fallbackToFirstActive: !targetListingId,
    targetListingId,
  });

  const [clientRequestId, setClientRequestId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifiedOffer, setVerifiedOffer] = useState<Offer | null>(null);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  type PaymentMethod = "BCA_VA" | "MANDIRI_VA" | "BRI_VA" | "BNI_VA" | "QRIS";
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BCA_VA");

  useEffect(() => {
    void syncSession();
  }, [syncSession]);

  useEffect(() => {
    const saved = sessionStorage.getItem("checkout_paymentMethod") as PaymentMethod;
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaymentMethod(saved);
    }
  }, []);

  const handleSetPaymentMethod = (method: typeof paymentMethod) => {
    setPaymentMethod(method);
    setClientRequestId(null);
    sessionStorage.setItem("checkout_paymentMethod", method);
  };

  const activeListing = targetListingId
    ? listings.find((l) => l.id === targetListingId) ?? null
    : listings[0] ?? null;
  const activeOfferId = activeListing
    ? items.find((i) => i.listingId === activeListing.id)?.offerId
    : undefined;

  useEffect(() => {
    let active = true;
    async function verifyOfferPrice() {
      if (!activeListing || !activeOfferId) {
        if (active) setVerifiedOffer(null);
        return;
      }

      try {
        const res = await fetch(
          `/api/offers/${encodeURIComponent(activeOfferId)}`,
          { cache: "no-store" }
        );

        // Preserve offerId on unauthenticated/transient 5xx errors; clear only on confirmed invalid/expired
        if (res.status === 404 || res.status === 422) {
          if (!active) return;
          setVerifiedOffer(null);
          addItem(activeListing.id);
          showToast(
            "Penawaran harga nego sudah tidak berlaku. Harga kembali ke harga iklan.",
            "info"
          );
          return;
        }

        if (!res.ok) {
          if (active) setVerifiedOffer(null);
          return;
        }

        const json = (await res.json()) as {
          offer?: Offer;
          isEligibleForCheckout?: boolean;
        };

        if (!active) return;
        if (
          json.isEligibleForCheckout &&
          json.offer &&
          json.offer.listingId === activeListing.id
        ) {
          setVerifiedOffer(json.offer);
        } else {
          setVerifiedOffer(null);
          addItem(activeListing.id);
          showToast(
            "Penawaran harga nego sudah tidak berlaku. Harga kembali ke harga iklan.",
            "info"
          );
        }
      } catch {
        if (active) setVerifiedOffer(null);
      }
    }

    void verifyOfferPrice();
    return () => {
      active = false;
    };
  }, [activeListing, activeOfferId, addItem, showToast]);

  const defaultSavedAddress =
    user.addresses.find((a) => a.isDefault) ||
    user.addresses[0] || {
      id: "addr-fallback",
      label: "Alamat Pengiriman",
      recipientName: user.name || "Pembeli NgeBekasinYuk",
      phone: user.phone || "0812-0000-0000",
      addressLine: "Jl. Sudirman Kav 28, Karet Tengsin, Tanah Abang",
      city: "Jakarta Pusat",
      postalCode: "10220",
      isDefault: true,
    };

  const [shippingRecipient, setShippingRecipient] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingLine, setShippingLine] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingPostal, setShippingPostal] = useState("");

  const effectiveRecipient =
    shippingRecipient || user.name || defaultSavedAddress.recipientName;
  const effectivePhone =
    shippingPhone || user.phone || defaultSavedAddress.phone;
  const effectiveAddressLine = shippingLine || defaultSavedAddress.addressLine;
  const effectiveCity = shippingCity || defaultSavedAddress.city;
  const effectivePostal = shippingPostal || defaultSavedAddress.postalCode;

  const shippingFee = selectedCourier.price;
  const escrowFee = 0;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <div className="h-24 rounded-2xl bg-surface-subtle animate-pulse" />
        <div className="h-64 rounded-2xl bg-surface-subtle animate-pulse" />
      </div>
    );
  }

  if (!activeListing) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        {droppedNotice && (
          <div
            role="alert"
            className="w-full p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2 text-left"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{droppedNotice}</span>
          </div>
        )}
        <h2 className="font-extrabold text-xl text-on-surface">
          Barang Tidak Tersedia untuk Checkout
        </h2>
        <p className="text-xs text-text-secondary max-w-sm">
          Unit yang dipilih sudah terjual, sedang dipesan, atau diarsipkan oleh
          penjual.
        </p>
        <Link href="/search">
          <Button variant="primary" size="md" className="font-bold">
            Cari Gadget Lainnya
          </Button>
        </Link>
      </div>
    );
  }

  const activePrice = verifiedOffer ? verifiedOffer.offerPrice : activeListing.price;
  const totalAmount = activePrice + shippingFee + escrowFee;
  const activeCover =
    activeListing.images[0] || "/assets/products/ipad-mini-unboxing.png";

  const handlePayEscrow = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const requestId = clientRequestId || crypto.randomUUID();
    if (!clientRequestId) {
      setClientRequestId(requestId);
    }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestId,
        },
        body: JSON.stringify({
          listingId: activeListing.id,
          shippingAddress: `${effectiveAddressLine}, ${effectiveCity} ${effectivePostal}`.trim(),
          courier: `${selectedCourier.name} ${selectedCourier.service}`,
          paymentMethod,
          ...(activeOfferId ? { offerId: activeOfferId } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.message || data.error || "Gagal membuat pesanan", "error");
        setIsSubmitting(false);
        return;
      }

      setClientRequestId(null);
      removeItem(activeListing.id);
      showToast("Pesanan dibuat! Mengalihkan ke pembayaran...", "info");
      router.push(`/payment/${data.id}/pending`);
    } catch (err) {
      console.error("[Checkout] Order creation failed:", err);
      showToast("Terjadi kesalahan jaringan. Silakan coba lagi.", "error");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6">
      {droppedNotice && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{droppedNotice}</span>
        </div>
      )}

      {/* Escrow Trust Micro-Banner */}
      <div className="bg-linear-to-r from-brand-secondary-light via-surface-subtle to-brand-primary-soft/30 p-4 rounded-2xl border border-brand-secondary/30 shadow-xs flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-secondary text-white flex items-center justify-center shrink-0 shadow-sm">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="font-bold text-sm text-on-surface">
              Dana Aman Ditahan Rekber
            </h2>
            <span className="bg-brand-secondary text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              Proteksi 100%
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
            Dana baru dicairkan ke penjual setelah kamu menerima paket dan lulus
            masa inspeksi <strong>2x24 jam</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* 1. Alamat Pengiriman */}
          <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-primary" />
                <h3 className="font-bold text-sm text-on-surface">
                  Alamat Pengiriman
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingAddress((v) => !v)}
                className="text-[11px] font-bold text-brand-primary hover:underline"
              >
                {isEditingAddress ? "Selesai" : "Ubah Alamat"}
              </button>
            </div>

            {isEditingAddress ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <input
                  type="text"
                  value={effectiveRecipient}
                  onChange={(e) => setShippingRecipient(e.target.value)}
                  placeholder="Nama Penerima"
                  className="px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border outline-none"
                />
                <input
                  type="text"
                  value={effectivePhone}
                  onChange={(e) => setShippingPhone(e.target.value)}
                  placeholder="Nomor HP"
                  className="px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border outline-none"
                />
                <input
                  type="text"
                  value={effectiveAddressLine}
                  onChange={(e) => setShippingLine(e.target.value)}
                  placeholder="Jalan / Nomor Rumah"
                  className="sm:col-span-2 px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border outline-none"
                />
                <input
                  type="text"
                  value={effectiveCity}
                  onChange={(e) => setShippingCity(e.target.value)}
                  placeholder="Kota"
                  className="px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={effectivePostal}
                    onChange={(e) => setShippingPostal(e.target.value)}
                    placeholder="Kode Pos"
                    className="flex-1 px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addAddress({
                        label: "Alamat Pengiriman",
                        recipientName: effectiveRecipient,
                        phone: effectivePhone,
                        addressLine: effectiveAddressLine,
                        city: effectiveCity,
                        postalCode: effectivePostal,
                        isDefault: true,
                      });
                      setIsEditingAddress(false);
                      showToast("Alamat pengiriman diperbarui.", "success");
                    }}
                    className="px-3 py-2 rounded-xl bg-brand-primary text-white font-bold shrink-0"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-surface-subtle rounded-xl flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-on-surface text-sm">
                    {effectiveRecipient}
                  </span>
                  <span className="text-text-muted">• {effectivePhone}</span>
                </div>
                <p className="text-text-secondary leading-relaxed mt-0.5">
                  {effectiveAddressLine}, {effectiveCity} {effectivePostal}
                </p>
                <div className="flex items-center gap-1 text-brand-secondary font-semibold text-[11px] mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Titik Pin Lokasi Akurat</span>
                </div>
              </div>
            )}
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
                    {activeListing.seller.verifiedKYC ? (
                      <span className="text-[10px] font-bold bg-brand-secondary-light text-brand-secondary px-1.5 py-0.2 rounded">
                        KYC Aktif
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold bg-surface-subtle text-text-muted px-1.5 py-0.2 rounded">
                        Penjual Terdaftar
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-text-muted">
                    {activeListing.seller.location}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3.5 pt-1">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-surface-subtle shrink-0">
                <Image
                  src={activeCover}
                  alt={activeListing.title}
                  fill
                  unoptimized={activeCover.startsWith("/api/")}
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
                  {verifiedOffer && (
                    <>
                      <span className="text-xs text-text-muted line-through tabular-nums">
                        {formatRupiah(activeListing.price)}
                      </span>
                      <span className="text-[10px] font-bold bg-brand-secondary-light text-brand-secondary px-1.5 py-0.5 rounded">
                        Harga Nego Disetujui
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Pilihan Jasa Pengiriman */}
          <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-brand-primary" />
              <h3 className="font-bold text-sm text-on-surface">
                Pilih Layanan Kurir
              </h3>
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
                        <span className="text-text-muted font-normal">
                          • {c.service}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {c.description}
                      </p>
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
              <h3 className="font-bold text-sm text-on-surface">
                Metode Pembayaran (Escrow)
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(
                [
                  { id: "BCA_VA", label: "BCA VA", badge: "Auto Cek" },
                  { id: "MANDIRI_VA", label: "Mandiri VA", badge: "Auto Cek" },
                  { id: "BRI_VA", label: "BRI VA", badge: "Auto Cek" },
                  { id: "BNI_VA", label: "BNI VA", badge: "Auto Cek" },
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

        {/* Right Column: Invoicing Summary */}
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
            disabled={isSubmitting}
            className="w-full font-bold gap-2 shadow-lg"
          >
            <Lock className="w-4 h-4" />
            <span>
              {isSubmitting ? "Memproses Pesanan..." : "Bayar dengan Escrow 🔒"}
            </span>
          </Button>

          <p className="text-[11px] text-text-muted text-center leading-relaxed">
            Dengan menekan tombol di atas, dana kamu akan diproteksi di rekening
            penampung resmi dan tidak akan dicairkan tanpa persetujuanmu.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-4">
          <div className="h-24 rounded-2xl bg-surface-subtle animate-pulse" />
          <div className="h-64 rounded-2xl bg-surface-subtle animate-pulse" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
