"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  Search,
  Bell,
  MessageSquare,
  Plus,
  ShieldCheck,
  Wallet,
  Package,
  FileText,
  Settings,
  Shield,
  ChevronDown,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useListingStore } from "@/stores/useListingStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { useChatStore } from "@/stores/useChatStore";
import { useUserStore } from "@/stores/useUserStore";
import { ThemeToggle } from "./ThemeToggle";
import { motion } from "framer-motion";

function getUserInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "NY";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { searchQuery, setSearchQuery } = useListingStore();
  const unreadNotifs = useNotificationStore((s) => s.getUnreadCount());
  const unreadChats = useChatStore((s) => s.getUnreadMessagesCount());
  const syncInbox = useChatStore((s) => s.syncInbox);
  const { user, isLoggedIn, authStatus, syncSession, logout } = useUserStore();

  const [mounted, setMounted] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [openMenuPathname, setOpenMenuPathname] = useState<string | null>(null);
  const isProfileOpen = openMenuPathname === pathname;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    async function hydrateAuthAndInbox() {
      await syncSession();
      if (active && useUserStore.getState().isLoggedIn) {
        await syncInbox();
      }
    }
    void hydrateAuthAndInbox();
    return () => {
      active = false;
    };
  }, [pathname, syncSession, syncInbox]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearch);
    router.push(`/search?q=${encodeURIComponent(localSearch)}`);
  };

  const handleLogout = async () => {
    setOpenMenuPathname(null);
    await logout();
    router.push("/login");
    router.refresh();
  };

  const showNotifBadge = mounted && isLoggedIn && unreadNotifs > 0;
  const showChatBadge = mounted && isLoggedIn && unreadChats > 0;

  return (
    <header className="sticky top-0 z-40 w-full glass-panel shadow-[0_1px_4px_rgba(16,24,40,0.04)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-5">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-xs border border-surface-border flex items-center justify-center bg-brand-primary-soft">
            <Image
              src="/assets/logo/logo.png"
              alt="NgeBekasinYuk Logo"
              width={40}
              height={40}
              className="object-cover w-full h-full"
            />
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm sm:text-lg text-on-surface tracking-tight group-hover:text-brand-primary transition-colors">
                NgeBekasin<span className="text-brand-primary">Yuk</span>
              </span>
              <span className="hidden md:inline-flex items-center gap-0.5 bg-brand-secondary-light text-brand-secondary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3" />
                Rekber
              </span>
            </div>
            <span className="hidden sm:block text-[11px] text-text-muted">
              Marketplace Gadget Terverifikasi
            </span>
          </div>
        </Link>

        {/* Global Search Input */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 min-w-0 max-w-xl relative flex items-center"
        >
          <div className="w-full min-w-0 relative flex items-center">
            <Search className="w-4 h-4 text-text-muted absolute left-2.5 sm:left-3.5 pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Cari iPhone, MacBook, GPU..."
              className="w-full min-w-0 h-9 sm:h-11 pl-8 sm:pl-10 pr-2.5 sm:pr-4 bg-surface-subtle text-on-surface placeholder:text-text-muted rounded-xl text-xs sm:text-sm border border-transparent focus:border-brand-primary focus:bg-white focus:ring-3 focus:ring-brand-primary/15 transition-all outline-none"
            />
          </div>
        </form>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          <ThemeToggle />

          {/* Notifications */}
          <Link
            href="/notifications"
            aria-label="Pusat Notifikasi"
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors relative"
          >
            <Bell className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            {showNotifBadge && (
              <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-2 h-2 rounded-full bg-brand-danger ring-2 ring-white" />
            )}
          </Link>

          {/* Chat (Desktop shortcut — Mobile uses MobileBottomNav) */}
          <Link
            href="/chat"
            aria-label="Pesan & Nego"
            className="hidden sm:flex w-10 h-10 rounded-xl items-center justify-center text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors relative"
          >
            <MessageSquare className="w-5 h-5" />
            {showChatBadge && (
              <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center justify-center">
                {unreadChats}
              </span>
            )}
          </Link>

          {/* Sell Button (Desktop CTA) */}
          <Link
            href="/sell"
            className="hidden md:inline-flex items-center gap-1.5 bg-brand-accent hover:bg-brand-accent-hover text-white font-bold text-sm px-4 h-11 rounded-xl shadow-[0_4px_16px_0_rgba(255,122,0,0.32)] transition-all hover:scale-[1.02] active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-3" />
            <span>Jual Gadget</span>
          </Link>

          {/* Auth Area: Real Session Dropdown or Guest Masuk/Daftar CTA */}
          {!mounted || authStatus === "loading" ? (
            <div className="w-9 h-9 rounded-xl bg-surface-subtle animate-pulse" />
          ) : !isLoggedIn ? (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="px-2.5 sm:px-3.5 h-8 sm:h-10 rounded-xl bg-brand-primary text-white font-bold text-xs sm:text-sm flex items-center justify-center hover:bg-brand-primary-hover transition-colors whitespace-nowrap"
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="hidden md:inline-flex px-3.5 h-10 rounded-xl border border-surface-border bg-white text-on-surface font-bold text-sm items-center justify-center hover:bg-surface-subtle transition-colors whitespace-nowrap"
              >
                Daftar
              </Link>
            </div>
          ) : (
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() =>
                  setOpenMenuPathname(isProfileOpen ? null : pathname)
                }
                aria-label="Menu Akun"
                className="flex items-center gap-1 p-0.5 sm:p-1 rounded-xl hover:bg-surface-subtle transition-colors"
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden bg-brand-primary-soft border border-brand-primary/20 flex items-center justify-center text-brand-primary font-bold text-xs">
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.name || "Avatar"}
                      width={36}
                      height={36}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span>{getUserInitials(user.name)}</span>
                  )}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-text-muted hidden sm:block" />
              </motion.button>

              {isProfileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setOpenMenuPathname(null)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-surface-border p-2 z-50 flex flex-col gap-1">
                    <div className="px-3 py-2 border-b border-surface-border mb-1">
                      <p className="font-bold text-sm text-on-surface truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-text-muted truncate">{user.email}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            user.isKYCVerified
                              ? "bg-brand-secondary-light text-brand-secondary"
                              : "bg-surface-subtle text-text-secondary"
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          {user.isKYCVerified ? "Terverifikasi" : "Belum e-KYC"}
                        </span>
                        {user.role && (
                          <span className="text-[10px] font-semibold text-brand-primary bg-brand-primary-soft px-1.5 py-0.5 rounded-md">
                            {user.role}
                          </span>
                        )}
                      </div>
                    </div>

                    <Link
                      href="/profile"
                      onClick={() => setOpenMenuPathname(null)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-brand-primary" />
                      <span>Profil Akun Saya</span>
                    </Link>

                    <Link
                      href="/orders"
                      onClick={() => setOpenMenuPathname(null)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors"
                    >
                      <Package className="w-4 h-4 text-brand-primary" />
                      <span>Pesanan Saya (Escrow)</span>
                    </Link>

                    <Link
                      href="/my-listings"
                      onClick={() => setOpenMenuPathname(null)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors"
                    >
                      <FileText className="w-4 h-4 text-brand-accent" />
                      <span>Kelola Iklan & Penjualan</span>
                    </Link>

                    <Link
                      href="/wallet"
                      onClick={() => setOpenMenuPathname(null)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors"
                    >
                      <Wallet className="w-4 h-4 text-brand-secondary" />
                      <span>Dompet Saldo Escrow</span>
                    </Link>

                    <Link
                      href="/profile/verification"
                      onClick={() => setOpenMenuPathname(null)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors"
                    >
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span>Verifikasi Akun (e-KYC)</span>
                    </Link>

                    {user.role === "ADMIN" && (
                      <>
                        <div className="h-px bg-surface-border my-1" />
                        <Link
                          href="/admin/dashboard"
                          onClick={() => setOpenMenuPathname(null)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors"
                        >
                          <Settings className="w-4 h-4 text-purple-600" />
                          <span>Admin Console (Dispute Hub)</span>
                        </Link>
                      </>
                    )}

                    <div className="h-px bg-surface-border my-1" />

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Keluar</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
