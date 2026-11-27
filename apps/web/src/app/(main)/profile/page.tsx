"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  MapPin,
  CheckCircle2,
  Lock,
  Smartphone,
  Mail,
  Package,
  Wallet,
  Clock,
  LogOut,
  LogIn,
} from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";
import { ListingCard } from "@/components/features/ListingCard";
import type { ProductListing } from "@/types";

type ProfileTab = "LISTINGS" | "REVIEWS" | "ABOUT";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoggedIn, authStatus, syncSession, logout } = useUserStore();
  const [myListings, setMyListings] = useState<ProductListing[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>("LISTINGS");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    void syncSession();
  }, [syncSession]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/listings?mine=true&limit=6", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && Array.isArray(json?.data)) {
          setMyListings(json.data);
        }
      } catch {
        // Non-fatal listings load failure
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const displayedListings = isLoggedIn ? myListings : [];

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    router.push("/login");
    router.refresh();
  };

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-surface pb-32 pt-6">
        <div className="max-w-2xl mx-auto px-4 space-y-4">
          <div className="h-48 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 animate-pulse" />
          <div className="h-24 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-surface pb-32 pt-10 px-4">
        <div className="max-w-md mx-auto bg-surface-container-lowest rounded-3xl p-7 border border-outline-variant/30 shadow-xs text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-primary-soft text-brand-primary flex items-center justify-center mx-auto">
            <LogIn className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-black text-on-surface">
            Masuk untuk Melihat Profil Akun
          </h1>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Informasi akun, status verifikasi e-KYC, iklan saya, dan dompet saldo rekber hanya tersedia untuk pengguna yang telah login.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Link
              href="/login?next=/profile"
              className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-xs hover:bg-primary/90"
            >
              Masuk ke Akun
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-xl bg-surface-container-low text-on-surface text-xs font-bold hover:bg-surface-container"
            >
              Daftar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName = user.name || "Pengguna NgeBekasinYuk";
  const displayCity = user.city || "Indonesia";
  const displayBio =
    user.bio || "Pengguna terautentikasi NgeBekasinYuk dengan proteksi rekening bersama.";
  const roleLabel =
    user.role === "ADMIN"
      ? "Administrator"
      : user.role === "SELLER"
      ? "Power Merchant"
      : "Tech Buyer & Seller";

  return (
    <div className="min-h-screen bg-surface pb-32 pt-4">
      <div className="max-w-2xl mx-auto px-4 space-y-4">
        {/* Profile Card Header */}
        <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-xs space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full bg-linear-to-tr from-primary to-primary-container flex items-center justify-center text-on-primary font-black text-2xl shadow-sm overflow-hidden">
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={displayName}
                    width={80}
                    height={80}
                    className="rounded-full object-cover w-full h-full"
                  />
                ) : (
                  <span>{displayName.slice(0, 2).toUpperCase()}</span>
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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <h1 className="text-base md:text-lg font-bold text-on-surface truncate">
                    {displayName}
                  </h1>
                  <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-1 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{isLoggingOut ? "Keluar..." : "Keluar"}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-1.5">
                <span className="bg-surface-container px-2 py-0.5 rounded font-medium">
                  {roleLabel}
                </span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3 text-primary" /> {displayCity}
                </span>
              </div>

              <p className="text-xs text-on-surface-variant mt-2 line-clamp-2">{displayBio}</p>
            </div>
          </div>

          {/* Verification Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-xs">
            <span className="flex items-center gap-1 bg-surface-container-low text-secondary font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{user.isKYCVerified ? "Identitas Terverifikasi" : "Verifikasi Dasar"}</span>
            </span>
            <span className="flex items-center gap-1 bg-surface-container-low text-secondary font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
              <Smartphone className="w-3.5 h-3.5" />
              <span>{user.phone ? `HP: ${user.phone}` : "HP Belum Diatur"}</span>
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

          {/* Real Account Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-surface-container-low p-2.5 rounded-2xl text-xs">
            <div className="bg-surface-container-lowest p-2.5 rounded-xl shadow-xs">
              <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">
                Status Akun
              </span>
              <div className="font-bold text-sm text-primary mt-0.5">
                {user.isKYCVerified ? "Terverifikasi" : "Aktif"}
              </div>
              <span className="text-[10px] text-secondary font-semibold">{user.role || "BUYER"}</span>
            </div>

            <div className="bg-surface-container-lowest p-2.5 rounded-xl shadow-xs">
              <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">
                Iklan Anda
              </span>
              <div className="font-bold text-sm text-on-surface mt-0.5">
                {displayedListings.length} Unit
              </div>
              <span className="text-[10px] text-secondary font-semibold">Data Server</span>
            </div>

            <div className="bg-surface-container-lowest p-2.5 rounded-xl shadow-xs">
              <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">
                Penjualan Tercatat
              </span>
              <div className="font-bold text-sm text-on-surface mt-0.5">
                {user.totalSales ?? 0} Sukses
              </div>
              <span className="text-[10px] text-on-surface-variant">Escrow Server</span>
            </div>

            <div className="bg-surface-container-lowest p-2.5 rounded-xl shadow-xs">
              <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">
                Bergabung
              </span>
              <div className="font-bold text-sm text-on-surface mt-0.5">
                {user.joinedDate || "Aktif"}
              </div>
              <span className="text-[10px] text-on-surface-variant">Akun Resmi</span>
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
              {displayedListings.length}
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
          displayedListings.length === 0 ? (
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 text-center text-xs text-on-surface-variant">
              Belum ada iklan gadget yang diterbitkan oleh akun ini.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pt-2">
              {displayedListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )
        )}

        {activeTab === "REVIEWS" && (
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 text-center space-y-2 text-xs">
            <h3 className="font-bold text-on-surface">Ulasan Pembeli Terverifikasi</h3>
            <p className="text-on-surface-variant leading-relaxed">
              Belum ada ulasan transaksi server untuk akun <strong>{displayName}</strong>.
            </p>
          </div>
        )}

        {activeTab === "ABOUT" && (
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 space-y-3 text-xs">
            <h3 className="font-bold text-on-surface">Kebijakan Pengiriman &amp; Garansi</h3>
            <p className="text-on-surface-variant leading-relaxed">
              Semua unit gadget yang ditransaksikan dilindungi sistem Rekening Bersama (Escrow) dengan masa inspeksi pembeli 2x24 jam setelah paket tiba.
            </p>
            <div className="h-px bg-outline-variant/20"></div>
            <h3 className="font-bold text-on-surface">Informasi Akun Terdaftar</h3>
            <div className="p-3 bg-surface-container-low rounded-xl space-y-1">
              <div className="font-bold text-on-surface">{displayName}</div>
              <div className="text-on-surface-variant">{user.email}</div>
              <div className="text-on-surface-variant">Kota: {displayCity}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
