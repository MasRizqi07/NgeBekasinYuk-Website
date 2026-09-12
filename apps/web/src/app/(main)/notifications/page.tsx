"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bell,
  ShieldCheck,
  Tag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  Truck,
} from "lucide-react";
import { useNotificationStore } from "@/stores/useNotificationStore";

type FilterTab = "ALL" | "ESCROW" | "OFFER" | "SYSTEM";

export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");

  const filtered = notifications.filter((item) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "ESCROW")
      return (
        item.type === "ESCROW" ||
        item.type === "ORDER" ||
        item.type === "SHIPPING" ||
        item.type === "INSPECTION" ||
        item.type === "COMPLETED" ||
        item.type === "DISPUTE"
      );
    if (activeTab === "OFFER") return item.type === "OFFER";
    if (activeTab === "SYSTEM") return item.type === "REVIEW" || item.type === "PROMO";
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "ESCROW":
      case "ORDER":
        return <ShieldCheck className="w-4 h-4 text-primary" />;
      case "OFFER":
        return <Tag className="w-4 h-4 text-amber-600" />;
      case "INSPECTION":
        return <Clock className="w-4 h-4 text-amber-600" />;
      case "SHIPPING":
        return <Truck className="w-4 h-4 text-blue-600" />;
      case "COMPLETED":
        return <CheckCircle2 className="w-4 h-4 text-secondary" />;
      case "DISPUTE":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Bell className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="min-h-screen bg-surface pb-32 pt-4">
      <div className="max-w-2xl mx-auto px-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-on-surface">Pusat Notifikasi</h1>
            <p className="text-xs text-on-surface-variant">
              Pembaruan status transaksi rekber, chat penawaran, dan keamanan akun
            </p>
          </div>
          <button
            onClick={markAllAsRead}
            className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Tandai Semua Dibaca</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
          {[
            { id: "ALL", label: "Semua" },
            { id: "ESCROW", label: "Transaksi & Escrow" },
            { id: "OFFER", label: "Penawaran Harga" },
            { id: "SYSTEM", label: "Info Sistem" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as FilterTab)}
              className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notification List */}
        {filtered.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-3xl p-12 text-center border border-outline-variant/30 space-y-3">
            <div className="w-14 h-14 rounded-full bg-surface-container-low flex items-center justify-center mx-auto text-on-surface-variant">
              <Bell className="w-6 h-6 opacity-40" />
            </div>
            <h3 className="font-bold text-sm text-on-surface">Tidak ada notifikasi di tab ini</h3>
            <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
              Notifikasi penting terkait transaksi dan negosiasi akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => markAsRead(item.id)}
                className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                  item.isRead
                    ? "bg-surface-container-lowest border-outline-variant/30 opacity-90"
                    : "bg-surface-container-lowest border-primary/30 shadow-xs ring-1 ring-primary/10"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    item.isRead ? "bg-surface-container" : "bg-primary/10"
                  }`}
                >
                  {getIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-on-surface truncate">{item.title}</h4>
                    <span className="text-[10px] text-on-surface-variant shrink-0">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="text-on-surface-variant mt-1 leading-relaxed">{item.message}</p>

                  {item.link && (
                    <Link
                      href={item.link}
                      className="inline-flex items-center gap-1 font-bold text-primary hover:underline mt-2 text-[11px]"
                    >
                      <span>Buka Halaman Terkait</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>

                {!item.isRead && (
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5"></span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
