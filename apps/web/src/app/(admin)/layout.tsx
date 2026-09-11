"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gavel,
  ShieldCheck,
  LayoutDashboard,
  Shield,
  FileCheck,
  Settings,
  Bell,
  Search,
  ChevronRight,
  User,
  ArrowLeft,
  DollarSign,
  Activity,
} from "lucide-react";
import { ToastProvider } from "@/components/ui/Toast";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/admin/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      href: "/admin/disputes",
      label: "Mediasi Sengketa",
      icon: Gavel,
      badge: "14",
      badgeColor: "bg-red-500/10 text-red-700 font-bold",
    },
    {
      href: "/profile/verification",
      label: "Review e-KYC",
      icon: ShieldCheck,
      badge: "28",
      badgeColor: "bg-primary/10 text-primary font-bold",
    },
    {
      href: "/wallet",
      label: "Escrow & Finansial",
      icon: DollarSign,
      badge: null,
    },
    {
      href: "/orders",
      label: "Daftar Pesanan Publik",
      icon: Activity,
      badge: null,
    },
  ];

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface flex">
        {/* Left Sidebar */}
        <aside className="fixed left-0 top-0 bottom-0 w-64 bg-surface-container-lowest z-50 flex flex-col border-r border-outline-variant/30 hidden lg:flex shadow-xs">
          {/* Brand Header */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-outline-variant/20">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-on-primary font-black text-sm shadow-xs">
                N
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-on-surface leading-tight">
                  NgeBekasin<span className="text-primary">Yuk</span>
                </span>
                <span className="text-[10px] text-on-surface-variant uppercase font-semibold tracking-wider">
                  Ops &amp; Mediation
                </span>
              </div>
            </Link>
          </div>

          {/* Cluster Status */}
          <div className="p-3">
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-surface-container-low text-xs border border-outline-variant/20">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                <span className="text-[11px] font-bold text-on-surface">PROD-CLUSTER-JKT</span>
              </div>
              <span className="text-[11px] font-bold text-secondary">99.98%</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-xs">
            <div className="px-3 py-1 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              Core Mediation
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-colors ${
                    isActive
                      ? "bg-primary text-on-primary shadow-xs"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] ${
                        isActive ? "bg-white/20 text-white" : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Admin User Footer */}
          <div className="p-3 border-t border-outline-variant/20">
            <div className="p-2.5 bg-surface-container-low rounded-2xl flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs shrink-0">
                SL
              </div>
              <div className="flex flex-col min-w-0 flex-1 text-xs">
                <span className="font-bold text-on-surface truncate">Sarah Lestari</span>
                <span className="text-[10px] text-on-surface-variant truncate">
                  Risk &amp; Ops Lead
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
          {/* Top Bar */}
          <header className="sticky top-0 z-40 h-16 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/30 flex items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <Link href="/" className="hover:text-primary flex items-center gap-1 font-semibold">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Marketplace</span>
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-outline-variant" />
              <span className="font-bold text-primary">Enterprise Console</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center relative">
                <Search className="w-4 h-4 text-on-surface-variant absolute left-3" />
                <input
                  type="text"
                  placeholder="Cari No. Tiket, Resi, IMEI..."
                  className="w-64 h-9 pl-9 pr-3 rounded-xl bg-surface-container-low text-xs text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <button className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors relative">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full"></span>
                </button>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs shrink-0">
                  SL
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
