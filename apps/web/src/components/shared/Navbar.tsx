"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { useListingStore } from "@/stores/useListingStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { useChatStore } from "@/stores/useChatStore";
import { useUserStore } from "@/stores/useUserStore";
import { ThemeToggle } from "./ThemeToggle";
import { motion } from "framer-motion";

export function Navbar() {
  const router = useRouter();
  const { searchQuery, setSearchQuery } = useListingStore();
  const unreadNotifs = useNotificationStore((s) => s.getUnreadCount());
  const unreadChats = useChatStore((s) => s.getUnreadMessagesCount());
  const { user } = useUserStore();

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearch);
    router.push(`/search?q=${encodeURIComponent(localSearch)}`);
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-panel shadow-[0_1px_4px_rgba(16,24,40,0.04)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3 sm:gap-6">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-xs border border-surface-border flex items-center justify-center bg-brand-primary-soft">
            <Image
              src="/assets/logo/logo.png"
              alt="NgeBekasinYuk Logo"
              width={40}
              height={40}
              className="object-cover w-full h-full"
            />
            <ShieldCheck className="w-6 h-6 text-brand-primary" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-lg text-on-surface tracking-tight group-hover:text-brand-primary transition-colors">
                NgeBekasin<span className="text-brand-primary">Yuk</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-0.5 bg-brand-secondary-light text-brand-secondary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
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
          className="flex-1 max-w-xl relative flex items-center"
        >
          <div className="w-full relative flex items-center">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Cari iPhone, MacBook, ThinkPad, GPU bekas..."
              className="w-full h-10 sm:h-11 pl-10 pr-4 bg-surface-subtle text-on-surface placeholder:text-text-muted rounded-xl text-xs sm:text-sm border border-transparent focus:border-brand-primary focus:bg-white focus:ring-3 focus:ring-brand-primary/15 transition-all outline-none"
            />
          </div>
        </form>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <ThemeToggle />

          {/* Notifications */}
          <Link
            href="/notifications"
            aria-label="Pusat Notifikasi"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifs > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-danger ring-2 ring-white" />
            )}
          </Link>

          {/* Chat */}
          <Link
            href="/chat"
            aria-label="Pesan & Nego"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors relative"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadChats > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center justify-center">
                {unreadChats}
              </span>
            )}
          </Link>

          {/* Sell Button (Desktop CTA) */}
          <Link
            href="/sell"
            className="hidden sm:inline-flex items-center gap-1.5 bg-brand-accent hover:bg-brand-accent-hover text-white font-bold text-sm px-4 h-11 rounded-xl shadow-[0_4px_16px_0_rgba(255,122,0,0.32)] transition-all hover:scale-[1.02] active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-3" />
            <span>Jual Gadget</span>
          </Link>

          {/* User Profile Dropdown */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-surface-subtle transition-colors"
            >
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-brand-primary-soft border border-brand-primary/20 flex items-center justify-center">
                <Image
                  src={user.avatar}
                  alt={user.name}
                  width={36}
                  height={36}
                  className="object-cover"
                />
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted hidden sm:block" />
            </motion.button>

            {isProfileOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsProfileOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-surface-border p-2 z-50 flex flex-col gap-1">
                  <div className="px-3 py-2 border-b border-surface-border mb-1">
                    <p className="font-bold text-sm text-on-surface truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-text-muted truncate">{user.email}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="inline-flex items-center gap-1 bg-brand-secondary-light text-brand-secondary text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                        <ShieldCheck className="w-3 h-3" />
                        Terverifikasi
                      </span>
                      <span className="text-[10px] font-semibold text-[#B26A00] bg-[#FFF4E0] px-1.5 py-0.5 rounded-md">
                        Skor {user.trustScore}
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/orders"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors"
                  >
                    <Package className="w-4 h-4 text-brand-primary" />
                    <span>Pesanan Saya (Escrow)</span>
                  </Link>

                  <Link
                    href="/my-listings"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors"
                  >
                    <FileText className="w-4 h-4 text-brand-accent" />
                    <span>Kelola Iklan & Penjualan</span>
                  </Link>

                  <Link
                    href="/wallet"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors"
                  >
                    <Wallet className="w-4 h-4 text-brand-secondary" />
                    <span>Dompet Saldo Escrow</span>
                  </Link>

                  <Link
                    href="/profile/verification"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors"
                  >
                    <Shield className="w-4 h-4 text-blue-500" />
                    <span>Verifikasi Akun (e-KYC)</span>
                  </Link>

                  <div className="h-px bg-surface-border my-1" />

                  <Link
                    href="/admin/dashboard"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-on-surface hover:bg-surface-subtle transition-colors"
                  >
                    <Settings className="w-4 h-4 text-purple-600" />
                    <span>Admin Console (Dispute Hub)</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
