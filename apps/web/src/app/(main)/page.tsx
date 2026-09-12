"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Smartphone,
  Laptop,
  Headphones,
  Cpu,
  Gamepad2,
  Camera,
  Keyboard,
  Flame,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useListingStore } from "@/stores/useListingStore";
import { EscrowBanner } from "@/components/shared/EscrowBanner";
import { ListingCard } from "@/components/features/ListingCard";
import { formatRupiah } from "@/lib/utils";

export default function HomePage() {
  const { listings, setSelectedCategory } = useListingStore();
  const [activeTab, setActiveTab] = useState("all");

  const categories = [
    {
      id: "smartphone",
      name: "Smartphone",
      desc: "iPhone, Pixel",
      icon: Smartphone,
      color: "bg-primary-fixed text-brand-primary",
    },
    {
      id: "laptop",
      name: "Laptop",
      desc: "MacBook, ROG",
      icon: Laptop,
      color: "bg-secondary-container/50 text-brand-secondary",
    },
    {
      id: "audio",
      name: "Audio",
      desc: "AirPods, Sony",
      icon: Headphones,
      color: "bg-tertiary-fixed text-[#954500]",
    },
    {
      id: "pc-gaming",
      name: "PC Gaming",
      desc: "RTX, Ryzen",
      icon: Cpu,
      color: "bg-primary-fixed-dim/40 text-brand-primary",
    },
    {
      id: "console",
      name: "Konsol",
      desc: "PS5, Switch",
      icon: Gamepad2,
      color: "bg-brand-danger-soft text-brand-danger",
    },
    {
      id: "camera",
      name: "Kamera",
      desc: "Sony, Fuji",
      icon: Camera,
      color: "bg-surface-subtle text-text-secondary",
    },
    {
      id: "accessories",
      name: "Aksesoris",
      desc: "GaN, Keychron",
      icon: Keyboard,
      color: "bg-brand-secondary-light text-brand-secondary",
    },
  ];

  // Nego highlights
  const negoItems = listings.filter((item) => item.canNego);

  // Feed items filtered by quick tab
  const feedItems = listings.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "like_new") return item.condition === "LIKE_NEW";
    if (activeTab === "nego") return item.canNego;
    if (activeTab === "laptop") return item.category === "laptop";
    if (activeTab === "smartphone") return item.category === "smartphone";
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 flex flex-col gap-6 sm:gap-10">
      {/* 1. Hero Escrow & Protection Banner */}
      <section>
        <EscrowBanner variant="hero" />
      </section>

      {/* 2. Popular Categories Horizontal Scroll */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-primary" />
            <h2 className="font-extrabold text-base sm:text-lg text-on-surface">
              Kategori Gadget Populer
            </h2>
          </div>
          <Link
            href="/search"
            className="text-xs sm:text-sm font-semibold text-brand-primary hover:underline flex items-center gap-1"
          >
            <span>Lihat Semua</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.id}
                href={`/search?category=${cat.id}`}
                onClick={() => setSelectedCategory(cat.id)}
                className="group flex flex-col items-center gap-2 min-w-[82px] sm:min-w-[100px] p-3 rounded-2xl bg-white border border-surface-border shadow-xs hover:shadow-md hover:border-brand-primary/40 transition-all text-center shrink-0 active:scale-95"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${cat.color}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-bold text-xs text-on-surface truncate w-18">
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-text-muted truncate w-16">
                    {cat.desc}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. 'Paling Banyak Dinego' Carousel */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-5 rounded-full bg-brand-accent" />
            <h2 className="font-extrabold text-base sm:text-lg text-on-surface">
              Paling Banyak Dinego 🔥
            </h2>
          </div>
          <Link
            href="/search?canNego=true"
            className="text-xs sm:text-sm font-semibold text-brand-accent hover:underline flex items-center gap-1"
          >
            <span>Eksplor Penawaran</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto no-scrollbar py-1">
          {negoItems.map((item) => (
            <div
              key={item.id}
              className="min-w-[260px] max-w-[260px] sm:min-w-[280px] sm:max-w-[280px] shrink-0"
            >
              <div className="relative group bg-white rounded-2xl border border-surface-border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col">
                <Link
                  href={`/product/${item.slug}`}
                  className="relative aspect-[16/10] w-full bg-surface-subtle overflow-hidden"
                >
                  <Image
                    src={item.images[0] || "/assets/products/ipad-mini-unboxing.png"}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 260px, 280px"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-brand-secondary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Rekber</span>
                  </div>
                  <div className="absolute bottom-2 left-2.5">
                    <span className="bg-black/70 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
                      {item.conditionLabel}
                    </span>
                  </div>
                </Link>

                <div className="p-3 flex flex-col gap-2">
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B26A00] bg-[#FFF4E0] px-2 py-0.5 rounded-md self-start">
                    <Flame className="w-3.5 h-3.5 text-brand-accent" />
                    <span>Sedang Banyak Penawar</span>
                  </div>

                  <Link
                    href={`/product/${item.slug}`}
                    className="font-bold text-xs text-on-surface line-clamp-1 hover:text-brand-primary"
                  >
                    {item.title}
                  </Link>

                  <div className="flex items-baseline justify-between pt-1 border-t border-surface-border">
                    <span className="font-extrabold text-sm text-on-surface tabular-nums">
                      {formatRupiah(item.price)}
                    </span>
                    <Link
                      href={`/chat/convo-dimas-ipad`}
                      className="text-xs font-bold text-brand-primary hover:underline"
                    >
                      Ajukan Nego
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Escrow Assurance Ribbon */}
      <section>
        <EscrowBanner variant="compact" />
      </section>

      {/* 5. Curated Feed Grid */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-extrabold text-lg sm:text-xl text-on-surface">
              Rekomendasi Gadget Bekas Teruji
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Semua unit lolos verifikasi nomor seri, bebas iCloud, dan dijamin Rekber.
            </p>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: "all", label: "Semua" },
              { id: "like_new", label: "Seperti Baru 99%" },
              { id: "nego", label: "Bisa Nego" },
              { id: "laptop", label: "MacBook & Laptop" },
              { id: "smartphone", label: "Smartphone" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-brand-primary text-white shadow-xs"
                    : "bg-surface-subtle text-text-secondary hover:bg-[#E3E8EF]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid: 2 cols on mobile, 3 on tablet, 4 on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {feedItems.map((listing, idx) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              priority={idx < 4}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
