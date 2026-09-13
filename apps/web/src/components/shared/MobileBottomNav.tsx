"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PackageCheck, Plus, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/useChatStore";

export function MobileBottomNav() {
  const pathname = usePathname();
  const unreadChats = useChatStore((s) => s.getUnreadMessagesCount());

  // Hide on admin routes
  if (pathname.startsWith("/admin")) return null;

  const navItems = [
    {
      label: "Beranda",
      href: "/",
      icon: Home,
      isActive: pathname === "/",
    },
    {
      label: "Transaksi",
      href: "/orders",
      icon: PackageCheck,
      isActive: pathname.startsWith("/orders") || pathname.startsWith("/payment"),
    },
    {
      label: "Jual",
      href: "/sell",
      isFab: true,
      icon: Plus,
      isActive: pathname === "/sell",
    },
    {
      label: "Chat",
      href: "/chat",
      icon: MessageSquare,
      badge: unreadChats > 0 ? unreadChats : undefined,
      isActive: pathname.startsWith("/chat"),
    },
    {
      label: "Akun",
      href: "/wallet",
      icon: User,
      isActive: pathname === "/wallet" || pathname.startsWith("/profile"),
    },
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-surface-border pb-safe">
      <div className="h-16 px-4 flex items-center justify-around relative">
        {navItems.map((item) => {
          if (item.isFab) {
            return (
              <div key={item.href} className="relative -top-4 flex flex-col items-center">
                <Link
                  href={item.href}
                  className="w-13 h-13 rounded-full bg-brand-accent hover:bg-brand-accent-hover text-white shadow-[0_8px_24px_rgba(255,122,0,0.42)] flex items-center justify-center active:scale-90 transition-transform"
                  aria-label="Pasang Iklan Gadget"
                >
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </Link>
                <span className="text-[10px] font-bold text-brand-accent mt-0.5">
                  + Jual
                </span>
              </div>
            );
          }

          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-14 h-full transition-colors relative",
                item.isActive ? "text-brand-primary font-bold" : "text-text-muted hover:text-text-secondary"
              )}
            >
              <div className="relative">
                <Icon className={cn("w-5 h-5", item.isActive && "stroke-[2.25]")} />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 min-w-3.75 h-3.5 px-0.5 rounded-full bg-brand-primary text-white text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
