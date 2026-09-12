"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MessageSquare,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { useChatStore } from "@/stores/useChatStore";
import { formatRupiah, timeAgo, useIsMounted } from "@/lib/utils";

export default function ChatInboxPage() {
  const { conversations } = useChatStore();
  const mounted = useIsMounted();

  return (
    <div className="min-h-screen bg-surface pb-28 pt-4">
      <div className="max-w-3xl mx-auto px-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-on-surface">Pesan &amp; Negosiasi</h1>
            <p className="text-xs text-on-surface-variant">
              Ruang obrolan langsung terlindungi sistem Escrow &amp; Rekber resmi
            </p>
          </div>
          <div className="flex items-center gap-1 text-secondary text-xs font-bold bg-secondary-fixed/40 px-3 py-1 rounded-full">
            <ShieldCheck className="w-4 h-4 text-secondary" />
            <span>Rekber Protected</span>
          </div>
        </div>

        {/* Escrow Caution Banner */}
        <div className="p-3 rounded-2xl bg-secondary-fixed/30 border border-secondary/20 flex items-start gap-2.5 text-xs text-on-secondary-fixed">
          <ShieldCheck className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Tips Keamanan:</strong> Jangan pernah bertukar nomor WhatsApp pribadi atau mentransfer dana di luar sistem NgeBekasinYuk. Garansi pengembalian dana 100% hanya berlaku untuk transaksi di dalam aplikasi.
          </p>
        </div>

        {/* Conversation List */}
        {conversations.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-3xl p-12 text-center border border-outline-variant/30 space-y-4">
            <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mx-auto text-on-surface-variant">
              <MessageSquare className="w-8 h-8 opacity-40" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-on-surface">Belum ada obrolan aktif</h3>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                Pilih gadget yang ingin kamu tawar atau tanyakan kondisinya kepada penjual langsung.
              </p>
            </div>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90"
            >
              <span>Mulai Cari Gadget</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((convo) => (
              <Link
                key={convo.id}
                href={`/chat/${convo.id}`}
                className="block bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 hover:border-primary/40 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-3.5">
                  {/* Seller Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-container border border-outline-variant/20 relative">
                      <Image
                        src={convo.counterpart.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
                        alt={convo.counterpart.name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                    {convo.counterpart.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-secondary rounded-full border-2 border-surface-container-lowest"></span>
                    )}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-sm text-on-surface truncate group-hover:text-primary transition-colors">
                          {convo.counterpart.name}
                        </span>
                        {convo.counterpart.isVerified && (
                          <span className="px-1.5 py-0.2 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold">
                            KYC
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-on-surface-variant shrink-0">
                        {mounted ? timeAgo(convo.lastTimestamp) : ""}
                      </span>
                    </div>

                    {/* Listing Preview Pill */}
                    <div className="flex items-center gap-2 mt-1.5 p-1.5 bg-surface-container-low rounded-xl">
                      <div className="w-7 h-7 rounded-lg overflow-hidden bg-surface-container shrink-0 relative">
                        <Image
                          src={convo.listing.images[0] || "/assets/products/ipad-mini-unboxing.png"}
                          alt={convo.listing.title}
                          fill
                          sizes="28px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex items-center justify-between text-xs">
                        <span className="text-on-surface truncate font-medium">
                          {convo.listing.title}
                        </span>
                        <span className="text-primary font-bold shrink-0 ml-2">
                          {formatRupiah(convo.listing.price)}
                        </span>
                      </div>
                    </div>

                    {/* Last message preview & unread badge */}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-on-surface-variant truncate max-w-[80%]">
                        {convo.lastMessage}
                      </p>
                      {convo.unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-black shrink-0">
                          {convo.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
