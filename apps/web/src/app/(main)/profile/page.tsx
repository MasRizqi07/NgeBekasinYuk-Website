"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  User,
  ShieldCheck,
  Star,
  MapPin,
  CheckCircle2,
  Lock,
  Smartphone,
  Mail,
  ChevronRight,
  Package,
  Wallet,
  Settings,
  LogOut,
  Edit,
  Tag,
  Share2,
  Heart,
  TrendingUp,
  Clock,
  Award,
} from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";
import { useListingStore } from "@/stores/useListingStore";
import { formatRupiah } from "@/lib/utils";
import ListingCard from "@/components/features/ListingCard";

type ProfileTab = "LISTINGS" | "REVIEWS" | "ABOUT";

export default function ProfilePage() {
  const { user } = useUserStore();
  const { listings } = useListingStore();
  const [activeTab, setActiveTab] = useState<ProfileTab>("LISTINGS");

  // User's own listings
  const myListings = listings.slice(0, 4);

  return (
    <div className="min-h-screen bg-surface pb-32 pt-4">
      <div className="max-w-2xl mx-auto px-4 space-y-4">
        {/* Profile Card Header */}
        <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-xs space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-on-primary font-black text-2xl shadow-sm">
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.name}
                    width={80}
                    height={80}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <span>{user.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              {user.isKYCVerified && (
                <div
                  className="absolute -bottom-1 -right-1 bg-secondary text-on-secondary p-1 rounded-full shadow-sm flex items-center justify-center"
                  title="Terverifikasi Resmi"
                >
                  <CheckCircle2 className="w-4 h-4 text-white fill-secondary" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h1 className="text-base md:text-lg font-bold text-on-surface truncate">
                  {user.name}
                </h1>
                <Link
                  href="/profile/verification"
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 transition-all ${
                    user.isKYCVerified
                      ? "bg-secondary-fixed text-on-secondary-fixed"
                      : "bg-primary text-on-primary shadow-xs hover:bg-primary/90"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{user.isKYCVerified ? "e-KYC Verified" : "Verifikasi e-KYC"}</span>
                </Link>
              </div>

              <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-1">
                <span className="bg-surface-container px-2 py-0.5 rounded font-medium">
                  {user.role === "SELLER" ? "Power Merchant" : "Tech Buyer & Seller"}
                </span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3 text-primary" /> {user.city}
                </span>
              </div>

              <p className="text-xs text-on-surface-variant mt-2 line-clamp-2">{user.bio}</p>
            </div>
          </div>

          {/* Verification Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-xs">
            <span className="flex items-center gap-1 bg-surface-container-low text-secondary font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>e-KYC KTP</span>
            </span>
            <span className="flex items-center gap-1 bg-surface-container-low text-secondary font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
              <Smartphone className="w-3.5 h-3.5" />
              <span>{user.phone ? "HP Terverifikasi" : "HP Terhubung"}</span>
            </span>
            <span className="flex items-center gap-1 bg-surface-container-low text-secondary font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
              <Mail className="w-3.5 h-3.5" />
              <span>Email Aktif</span>
            </span>
            <span className="flex items-center gap-1 bg-secondary-fixed text-on-secondary-fixed font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
              <Lock className="w-3.5 h-3.5" />
              <span>Rekber Ready</span>
            </span>
          </div>

          {/* Trust Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-surface-container-low p-2.5 rounded-2xl text-xs">
            <div className="bg-surface-container-lowest p-2.5 rounded-xl shadow-xs">
              <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">
                Trust Score
              </span>
              <div className="font-bold text-sm text-primary mt-0.5 flex items-center gap-1">
                <span>{user.trustScore}</span>
                <span className="text-[10px] text-on-surface-variant">/ 100</span>
              </div>
              <span className="text-[10px] text-secondary font-semibold">Top 3% Platform</span>
            </div>

            <div className="bg-surface-container-lowest p-2.5 rounded-xl shadow-xs">
              <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">
                Transaksi Escrow
              </span>
              <div className="font-bold text-sm text-on-surface mt-0.5">
                {user.totalSales} Sukses
              </div>
              <span className="text-[10px] text-secondary font-semibold">100% Tanpa Retur</span>
            </div>

            <div className="bg-surface-container-lowest p-2.5 rounded-xl shadow-xs">
              <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">
                Balas Chat
              </span>
              <div className="font-bold text-sm text-on-surface mt-0.5">±10 mnt</div>
              <span className="text-[10px] text-on-surface-variant">98% Terbalas</span>
            </div>

            <div className="bg-surface-container-lowest p-2.5 rounded-xl shadow-xs">
              <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">
                Bergabung
              </span>
              <div className="font-bold text-sm text-on-surface mt-0.5">Mar 2025</div>
              <span className="text-[10px] text-on-surface-variant">1+ Tahun Aktif</span>
            </div>
          </div>
        </div>

        {/* Quick Menu Shortcuts */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Link
            href="/wallet"
            className="p-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs hover:border-primary/40 transition-all flex flex-col items-center text-center gap-1"
          >
            <Wallet className="w-5 h-5 text-primary" />
            <span className="font-bold text-on-surface">Dompet Escrow</span>
          </Link>
          <Link
            href="/my-listings"
            className="p-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs hover:border-primary/40 transition-all flex flex-col items-center text-center gap-1"
          >
            <Package className="w-5 h-5 text-secondary" />
            <span className="font-bold text-on-surface">Kelola Iklan</span>
          </Link>
          <Link
            href="/orders"
            className="p-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs hover:border-primary/40 transition-all flex flex-col items-center text-center gap-1"
          >
            <Clock className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-on-surface">Pesanan Saya</span>
          </Link>
        </div>

        {/* Segmented Tab Bar */}
        <div className="flex items-center gap-2 border-b border-outline-variant/30 pt-2 text-xs">
          <button
            onClick={() => setActiveTab("LISTINGS")}
            className={`pb-3 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "LISTINGS"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span>Iklan Gadget</span>
            <span className="px-1.5 py-0.2 rounded-full bg-surface-container text-[10px]">
              {myListings.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("REVIEWS")}
            className={`pb-3 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "REVIEWS"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span>Ulasan Pembeli</span>
            <span className="px-1.5 py-0.2 rounded-full bg-primary-fixed text-on-primary-fixed text-[10px]">
              40
            </span>
          </button>
          <button
            onClick={() => setActiveTab("ABOUT")}
            className={`pb-3 font-bold border-b-2 transition-all ${
              activeTab === "ABOUT"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Tentang Akun
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "LISTINGS" && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            {myListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {activeTab === "REVIEWS" && (
          <div className="space-y-3 pt-2 text-xs">
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs flex items-center justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-on-surface">4.9</span>
                  <span className="text-on-surface-variant font-medium">/ 5.0</span>
                </div>
                <div className="flex items-center gap-0.5 text-amber-500 mt-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-500" />
                  ))}
                </div>
              </div>
              <span className="text-secondary font-bold bg-secondary-fixed/40 px-2.5 py-1 rounded-full text-[11px]">
                100% Kepuasan Escrow
              </span>
            </div>

            {/* Testimonials */}
            {[
              {
                name: "Budi Pratama",
                item: "MacBook Air M1 256GB",
                comment: "Unit mulus banget sesuai deskripsi seller. Baterai masih 98%. Packing kayu dan bubble tebal!",
                date: "2 hari lalu",
              },
              {
                name: "Siti Rahmawati",
                item: "Sony A7 III Body Only",
                comment: "Seller responsif dan ramah, shutter count rendah. Senang belanja pakai sistem escrow aman.",
                date: "1 minggu lalu",
              },
            ].map((rev, idx) => (
              <div
                key={idx}
                className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-surface">{rev.name}</span>
                  <span className="text-[10px] text-on-surface-variant">{rev.date}</span>
                </div>
                <span className="text-[11px] text-primary font-semibold block">{rev.item}</span>
                <p className="text-on-surface-variant leading-relaxed">{rev.comment}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "ABOUT" && (
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 space-y-3 text-xs">
            <h3 className="font-bold text-on-surface">Kebijakan Pengiriman &amp; Garansi</h3>
            <p className="text-on-surface-variant leading-relaxed">
              Semua unit gadget yang dikirim telah melalui 20 titik inspeksi fungsional. Kami mendukung pengiriman via J&amp;T, SiCepat, dan Paxel dengan proteksi rekber escrow 2x24 jam.
            </p>
            <div className="h-px bg-outline-variant/20"></div>
            <h3 className="font-bold text-on-surface">Daftar Alamat Pengiriman</h3>
            <div className="p-3 bg-surface-container-low rounded-xl">
              <span className="font-bold text-on-surface block">Alamat Utama</span>
              <p className="text-on-surface-variant mt-0.5 leading-relaxed">
                Jl. Mawar Asri No. 18, RT 04/RW 02, Pondok Kelapa, Duren Sawit, Jakarta Timur
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
