"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MessageSquare,
  ShieldCheck,
  Search,
  ChevronRight,
  Lock,
  RefreshCw,
} from "lucide-react";
import type { Conversation } from "@/types";
import { useChatStore } from "@/stores/useChatStore";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export default function ChatInboxPage() {
  const { setUnreadTotal } = useChatStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const backoffMsRef = useRef(5000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInbox = useCallback(
    async (isBackground = false): Promise<boolean> => {
      try {
        const res = await fetch("/api/conversations?limit=30", {
          cache: "no-store",
        });

        if (res.status === 401) {
          setIsUnauthorized(true);
          setConversations([]);
          setUnreadTotal(0);
          setErrorMessage(null);
          setIsLoading(false);
          return false;
        }

        const json = (await res.json().catch(() => null)) as {
          data?: Conversation[];
          unreadTotal?: number;
          message?: string;
        } | null;

        if (!res.ok || !json || !Array.isArray(json.data)) {
          throw new Error(json?.message || "Gagal memuat daftar percakapan.");
        }

        setIsUnauthorized(false);
        setConversations(json.data);
        const totalUnread =
          typeof json.unreadTotal === "number"
            ? json.unreadTotal
            : json.data.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        setUnreadTotal(totalUnread);
        setErrorMessage(null);
        setIsLoading(false);
        backoffMsRef.current = 5000;
        return true;
      } catch (err) {
        if (!isBackground) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : "Gagal terhubung ke server obrolan."
          );
          setIsLoading(false);
        }
        backoffMsRef.current = Math.min(30000, backoffMsRef.current * 2);
        return true;
      }
    },
    [setUnreadTotal]
  );

  useEffect(() => {
    let active = true;

    const clearScheduled = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleNext = () => {
      clearScheduled();
      if (!active || document.visibilityState !== "visible") return;
      timerRef.current = setTimeout(async () => {
        if (!active || document.visibilityState !== "visible") return;
        const shouldContinue = await fetchInbox(true);
        if (active && shouldContinue && document.visibilityState === "visible") {
          scheduleNext();
        }
      }, backoffMsRef.current);
    };

    const init = async () => {
      const shouldContinue = await fetchInbox(false);
      if (active && shouldContinue && document.visibilityState === "visible") {
        scheduleNext();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchInbox(true).then((ok) => {
          if (active && ok) scheduleNext();
        });
      } else {
        clearScheduled();
      }
    };

    void init();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      clearScheduled();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchInbox]);

  const filtered = conversations.filter((c) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      c.counterpart.name.toLowerCase().includes(q) ||
      c.listing.title.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-3">
        <div className="h-12 rounded-2xl bg-surface-subtle animate-pulse" />
        <div className="h-24 rounded-2xl bg-surface-subtle animate-pulse" />
        <div className="h-24 rounded-2xl bg-surface-subtle animate-pulse" />
      </div>
    );
  }

  if (isUnauthorized) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand-primary-soft text-brand-primary flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="font-extrabold text-xl text-on-surface">
          Masuk untuk Melihat Obrolan & Nego
        </h1>
        <p className="text-xs text-text-secondary leading-relaxed">
          Seluruh riwayat chat dan penawaran harga disimpan aman di server dan
          hanya bisa diakses oleh peserta transaksi terautentikasi.
        </p>
        <Link href="/login?next=/chat">
          <Button variant="primary" size="md" className="font-bold">
            Masuk ke Akun
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-extrabold text-xl sm:text-2xl text-on-surface flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-brand-primary" />
            <span>Pesan &amp; Nego Harga</span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Diskusikan kondisi gadget dan negosiasikan harga resmi di sini.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari penjual atau gadget..."
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-white border border-surface-border text-xs outline-none focus:border-brand-primary"
          />
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between gap-3"
        >
          <span>{errorMessage}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchInbox(false)}
            className="gap-1 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Coba Lagi</span>
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-16 bg-white rounded-2xl border border-surface-border text-center flex flex-col items-center justify-center gap-3 p-6">
          <div className="w-16 h-16 rounded-full bg-surface-subtle text-text-muted flex items-center justify-center">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h2 className="font-bold text-base text-on-surface">
            {searchTerm
              ? "Tidak ada obrolan yang cocok"
              : "Belum ada obrolan aktif"}
          </h2>
          <p className="text-xs text-text-secondary max-w-sm">
            Buka halaman produk gadget yang kamu minati dan klik tombol
            &ldquo;Chat&rdquo; atau &ldquo;Tawar Harga&rdquo; untuk memulai
            diskusi.
          </p>
          <Link href="/search" className="mt-2">
            <Button variant="primary" size="sm" className="font-bold">
              Jelajahi Katalog Gadget
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((convo) => {
            const cover =
              convo.listing.images[0] || "/assets/products/ipad-mini-unboxing.png";
            const latestOffer = convo.offers?.[0];

            return (
              <Link
                key={convo.id}
                href={`/chat/${convo.id}`}
                className="bg-white hover:bg-surface-subtle/50 transition-colors p-4 rounded-2xl border border-surface-border shadow-xs flex items-center gap-3.5 group"
              >
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-surface-subtle shrink-0">
                  <Image
                    src={convo.counterpart.avatar}
                    alt={convo.counterpart.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-sm text-on-surface truncate">
                        {convo.counterpart.name}
                      </span>
                      {convo.counterpart.verifiedKYC && (
                        <ShieldCheck className="w-3.5 h-3.5 text-brand-secondary shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-text-muted shrink-0">
                      {new Date(convo.lastTimestamp).toLocaleTimeString(
                        "id-ID",
                        { hour: "2-digit", minute: "2-digit" }
                      )}
                    </span>
                  </div>

                  <p className="text-xs text-text-secondary truncate mt-0.5">
                    {convo.lastMessage || "Mulai diskusi produk"}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <div className="relative w-6 h-6 rounded-md overflow-hidden bg-surface-subtle shrink-0">
                      <Image
                        src={cover}
                        alt={convo.listing.title}
                        fill
                        unoptimized={cover.startsWith("/api/")}
                        sizes="24px"
                        className="object-cover"
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-on-surface truncate">
                      {convo.listing.title}
                    </span>
                    <span className="text-[11px] font-bold text-brand-primary shrink-0 tabular-nums">
                      {formatRupiah(convo.listing.price)}
                    </span>
                    {latestOffer && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-primary-soft text-brand-primary shrink-0">
                        Nego {latestOffer.status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {convo.unreadCount > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-brand-primary text-white text-[11px] font-bold flex items-center justify-center">
                      {convo.unreadCount}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-brand-primary transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
