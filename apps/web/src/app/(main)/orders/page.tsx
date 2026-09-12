"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBag,
  ArrowRight,
  Clock,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Star,
  ExternalLink,
} from "lucide-react";
import { useOrderStore } from "@/stores/useOrderStore";
import { Order, OrderStatus } from "@/types";
import { formatRupiah, copyTextToClipboard } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import ReviewModal from "@/components/features/ReviewModal";

type TabFilter = "ALL" | "PENDING_PAYMENT" | "SHIPPED" | "INSPECTING" | "COMPLETED" | "DISPUTED";

export default function OrdersPage() {
  const { orders } = useOrderStore();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabFilter>("ALL");
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredOrders = orders.filter((order) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "PENDING_PAYMENT") return order.status === "PENDING_PAYMENT";
    if (activeTab === "SHIPPED") return order.status === "FUNDED" || order.status === "SHIPPED";
    if (activeTab === "INSPECTING") return order.status === "INSPECTING";
    if (activeTab === "COMPLETED") return order.status === "COMPLETED";
    if (activeTab === "DISPUTED") return order.status === "DISPUTED";
    return true;
  });

  const handleCopy = async (id: string) => {
    const ok = await copyTextToClipboard(id);
    if (ok) {
      setCopiedId(id);
      showToast("No. Pesanan berhasil disalin", "success");
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "PENDING_PAYMENT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5 animate-pulse" /> Menunggu Bayar
          </span>
        );
      case "FUNDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Escrow Aman (Diproses)
          </span>
        );
      case "SHIPPED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-700 border border-blue-500/20">
            <Truck className="w-3.5 h-3.5" /> Sedang Dikirim
          </span>
        );
      case "INSPECTING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-primary-fixed text-on-primary-fixed border border-primary/30 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-primary" /> Masa Uji Aktif (48 Jam)
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-secondary-fixed text-on-secondary-fixed">
            <CheckCircle2 className="w-3.5 h-3.5 text-secondary" /> Selesai
          </span>
        );
      case "DISPUTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-700 border border-red-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Dalam Mediasi
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-surface pb-28 pt-4">
      <div className="max-w-4xl mx-auto px-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-on-surface">Pesanan Saya</h1>
            <p className="text-xs md:text-sm text-on-surface-variant">
              Semua transaksi dilindungi sistem Rekening Bersama Escrow Resmi
            </p>
          </div>
          <Link
            href="/help/escrow"
            className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
          >
            <span>Pelajari Alur Rekber</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Filter Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: "ALL", label: "Semua" },
            { id: "PENDING_PAYMENT", label: "Menunggu Bayar" },
            { id: "SHIPPED", label: "Diproses / Dikirim" },
            { id: "INSPECTING", label: "Perlu Diperiksa (Uji)" },
            { id: "COMPLETED", label: "Selesai" },
            { id: "DISPUTED", label: "Komplain" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabFilter)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-3xl p-12 text-center border border-outline-variant/30 space-y-4">
            <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mx-auto text-on-surface-variant">
              <ShoppingBag className="w-8 h-8 opacity-40" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-on-surface">Belum ada pesanan di tab ini</h3>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                Cari gadget secondhand terverifikasi bergaransi escrow dan lakukan transaksi aman.
              </p>
            </div>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-xs hover:bg-primary/90"
            >
              <span>Jelajahi Gadget</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Order Head */}
                <div className="px-4 py-3 bg-surface-container-low/60 border-b border-outline-variant/20 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant font-medium">No. Pesanan:</span>
                    <button
                      onClick={() => handleCopy(order.id)}
                      className="font-mono text-xs font-bold text-on-surface flex items-center gap-1 hover:text-primary"
                    >
                      <span>{order.id}</span>
                      {copiedId === order.id ? (
                        <Check className="w-3 h-3 text-secondary" />
                      ) : (
                        <Copy className="w-3 h-3 text-on-surface-variant" />
                      )}
                    </button>
                    <span className="text-outline-variant">•</span>
                    <span className="text-xs font-semibold text-on-surface">
                      {order.listing.seller.name}
                    </span>
                  </div>
                  <div>{getStatusBadge(order.status)}</div>
                </div>

                {/* Order Body */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-16 h-16 rounded-xl bg-surface-container overflow-hidden shrink-0 relative border border-outline-variant/20">
                      <Image
                        src={order.listing.images[0] || "/assets/products/ipad-mini-unboxing.png"}
                        alt={order.listing.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-bold text-sm text-on-surface hover:text-primary transition-colors line-clamp-1"
                      >
                        {order.listing.title}
                      </Link>
                      <div className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-2">
                        <span>Kurir: {order.courier}</span>
                        {order.trackingNumber && (
                          <span className="font-mono font-bold text-primary">
                            Resi: {order.trackingNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-primary mt-1">
                        Total Tagihan: {formatRupiah(order.totalAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Actions based on status */}
                  <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                    {order.status === "PENDING_PAYMENT" && (
                      <Link
                        href={`/payment/${order.id}/pending`}
                        className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors shadow-xs"
                      >
                        Bayar Sekarang
                      </Link>
                    )}

                    {order.status === "INSPECTING" && (
                      <Link
                        href={`/orders/${order.id}`}
                        className="px-4 py-2 bg-secondary text-on-secondary rounded-xl text-xs font-bold shadow-xs hover:bg-secondary/90 transition-all flex items-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Uji &amp; Lepas Dana</span>
                      </Link>
                    )}

                    {order.status === "COMPLETED" && !order.reviewGiven && (
                      <button
                        onClick={() => setReviewOrder(order)}
                        className="px-4 py-2 bg-surface-container-high text-on-surface rounded-xl text-xs font-bold hover:bg-surface-container transition-colors flex items-center gap-1"
                      >
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>Beri Ulasan</span>
                      </button>
                    )}

                    {order.status === "DISPUTED" && (
                      <Link
                        href={`/disputes/${order.disputeId || "DSP-2026-88421"}`}
                        className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Ruang Mediasi</span>
                      </Link>
                    )}

                    <Link
                      href={`/orders/${order.id}`}
                      className="px-3.5 py-2 bg-surface-container-low text-on-surface rounded-xl text-xs font-bold hover:bg-surface-container transition-colors"
                    >
                      Lacak Status
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewOrder && (
        <ReviewModal
          isOpen={true}
          order={reviewOrder}
          onClose={() => setReviewOrder(null)}
        />
      )}
    </div>
  );
}
