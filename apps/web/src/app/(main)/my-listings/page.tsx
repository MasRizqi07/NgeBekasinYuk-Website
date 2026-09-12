"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Plus,
  Eye,
  Heart,
  Edit,
  ExternalLink,
} from "lucide-react";
import { useListingStore } from "@/stores/useListingStore";
import { formatRupiah } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

type ListingFilter = "ALL" | "ACTIVE" | "SOLD";

export default function MyListingsPage() {
  const { listings } = useListingStore();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<ListingFilter>("ALL");

  const sellerListings = listings.slice(0, 6);

  return (
    <div className="min-h-screen bg-surface pb-32 pt-4">
      <div className="max-w-3xl mx-auto px-4 space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-on-surface">Kelola Iklan Gadget</h1>
            <p className="text-xs text-on-surface-variant">
              Dashboard inventaris gadget secondhand dan status penjualan escrow
            </p>
          </div>
          <Link
            href="/sell"
            className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-xs hover:bg-primary/90 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Pasang Iklan Baru</span>
          </Link>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5 text-xs">
          <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs">
            <span className="text-[11px] text-on-surface-variant block">Iklan Aktif</span>
            <div className="font-bold text-base text-on-surface mt-0.5">
              {sellerListings.length} Unit
            </div>
            <span className="text-[10px] text-secondary font-semibold">Ready to Escrow</span>
          </div>
          <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs">
            <span className="text-[11px] text-on-surface-variant block">Total Tayangan</span>
            <div className="font-bold text-base text-primary mt-0.5">2.418 Views</div>
            <span className="text-[10px] text-primary font-semibold">+14% minggu ini</span>
          </div>
          <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs">
            <span className="text-[11px] text-on-surface-variant block">Terjual via Rekber</span>
            <div className="font-bold text-base text-secondary mt-0.5">18 Transaksi</div>
            <span className="text-[10px] text-secondary font-semibold">100% Cair Mulus</span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 text-xs">
          {[
            { id: "ALL", label: "Semua Iklan" },
            { id: "ACTIVE", label: "Sedang Tayang" },
            { id: "SOLD", label: "Sudah Terjual" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as ListingFilter)}
              className={`px-4 py-2 rounded-full font-bold transition-all ${
                filter === tab.id
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Listings List */}
        <div className="space-y-3">
          {sellerListings.map((item) => (
            <div
              key={item.id}
              className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-20 h-20 rounded-xl bg-surface-container overflow-hidden shrink-0 relative border border-outline-variant/20">
                  <Image
                    src={item.images[0] || "/assets/products/ipad-mini-unboxing.png"}
                    alt={item.title}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.2 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold">
                      Aktif Tayang
                    </span>
                    <span className="text-on-surface-variant text-[11px]">
                      {item.condition === "LIKE_NEW" ? "Mulus 99%" : "Secondhand"}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-on-surface truncate mt-1">{item.title}</h3>
                  <div className="font-bold text-primary text-sm mt-0.5">
                    {formatRupiah(item.price)}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-on-surface-variant mt-1.5">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-outline" /> 342 dilihat
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-outline" /> 24 wishlist
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 text-xs">
                <Link
                  href={`/product/${item.slug}`}
                  className="px-3.5 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Lihat</span>
                </Link>
                <button
                  onClick={() => showToast("Fitur ubah harga & stok unit terbuka", "info")}
                  className="px-3.5 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
