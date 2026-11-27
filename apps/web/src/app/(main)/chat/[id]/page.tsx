"use client";

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Send,
  Tag,
  ShieldCheck,
  ShoppingBag,
  Lock,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { ChatMessage, Conversation, Offer } from "@/types";
import { useCartStore } from "@/stores/useCartStore";
import { useChatStore } from "@/stores/useChatStore";
import { formatRupiah } from "@/lib/utils";
import { OfferCard } from "@/components/features/OfferCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

const BASE_POLL_MS = 3000;
const MAX_POLL_BACKOFF_MS = 30000;

export default function ChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: convoId } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const { addItem } = useCartStore();
  const { syncInbox } = useChatStore();

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState<
    "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | null
  >(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [inputText, setInputText] = useState("");
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [isOfferBusy, setIsOfferBusy] = useState(false);

  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerAmountInput, setOfferAmountInput] = useState(0);
  const [nowMs, setNowMs] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const afterCursorRef = useRef<string | null>(null);
  const backoffMsRef = useRef<number>(BASE_POLL_MS);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mergePolledUpdates = useCallback(
    (
      payload: {
        data?: ChatMessage[];
        offers?: Offer[];
        listingStatus?: string;
        nextCursor?: string | null;
      },
      advanceCursor = true
    ) => {
      if (advanceCursor && payload.nextCursor) {
        afterCursorRef.current = payload.nextCursor;
      }

      setConvo((prev) => {
        if (!prev) return prev;
        const incoming = Array.isArray(payload.data) ? payload.data : [];
        const existingIds = new Set(prev.messages.map((m) => m.id));
        const mergedMessages = [...prev.messages];

        for (const msg of incoming) {
          if (!existingIds.has(msg.id)) {
            existingIds.add(msg.id);
            mergedMessages.push(msg);
          }
        }

        const nextStatus = payload.listingStatus
          ? (payload.listingStatus as Conversation["listing"]["status"])
          : prev.listing.status;

        const nextOffers = Array.isArray(payload.offers)
          ? payload.offers
          : prev.offers;

        const lastMsg = mergedMessages[mergedMessages.length - 1];

        return {
          ...prev,
          messages: mergedMessages,
          offers: nextOffers,
          lastMessage: lastMsg ? lastMsg.text.slice(0, 140) : prev.lastMessage,
          lastTimestamp: lastMsg ? lastMsg.timestamp : prev.lastTimestamp,
          listing: {
            ...prev.listing,
            status: nextStatus,
          },
        };
      });
    },
    []
  );

  const loadInitialConversation = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [sessionRes, convoRes] = await Promise.all([
        fetch("/api/auth/session", { cache: "no-store" }),
        fetch(`/api/conversations/${encodeURIComponent(convoId)}`, {
          cache: "no-store",
        }),
      ]);

      const sessionJson = (await sessionRes.json().catch(() => null)) as {
        authenticated?: boolean;
        user?: { id: string } | null;
      } | null;

      if (!sessionJson?.authenticated || !sessionJson.user?.id || convoRes.status === 401) {
        setAccessDenied("UNAUTHORIZED");
        setIsLoading(false);
        return false;
      }

      if (convoRes.status === 403) {
        setAccessDenied("FORBIDDEN");
        setIsLoading(false);
        return false;
      }

      if (convoRes.status === 404) {
        setAccessDenied("NOT_FOUND");
        setIsLoading(false);
        return false;
      }

      const convoJson = (await convoRes.json().catch(() => null)) as
        | (Conversation & { message?: string })
        | null;

      if (!convoRes.ok || !convoJson) {
        throw new Error(convoJson?.message || "Gagal memuat percakapan.");
      }

      setViewerId(sessionJson.user.id);
      setConvo(convoJson);
      setNowMs(Date.now());
      setOfferAmountInput(Math.max(10000, Math.round(convoJson.listing.price * 0.9)));
      setAccessDenied(null);
      setIsLoading(false);

      const lastMsg = convoJson.messages[convoJson.messages.length - 1];
      afterCursorRef.current = lastMsg ? lastMsg.id : null;
      backoffMsRef.current = BASE_POLL_MS;
      void syncInbox();
      return true;
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Gagal memuat percakapan."
      );
      setIsLoading(false);
      return false;
    }
  }, [convoId, syncInbox]);

  const pollOnce = useCallback(async (): Promise<"ok" | "stop" | "retry"> => {
    try {
      const qs = new URLSearchParams();
      if (afterCursorRef.current) {
        qs.set("after", afterCursorRef.current);
      }
      const res = await fetch(
        `/api/conversations/${encodeURIComponent(convoId)}/messages?${qs.toString()}`,
        { cache: "no-store" }
      );

      if (res.status === 401 || res.status === 403 || res.status === 404) {
        return "stop";
      }

      if (!res.ok) {
        backoffMsRef.current = Math.min(
          MAX_POLL_BACKOFF_MS,
          backoffMsRef.current * 2
        );
        return "retry";
      }

      const payload = (await res.json()) as {
        data?: ChatMessage[];
        offers?: Offer[];
        listingStatus?: string;
        nextCursor?: string | null;
      };
      backoffMsRef.current = BASE_POLL_MS;
      setNowMs(Date.now());
      mergePolledUpdates(payload);
      return "ok";
    } catch {
      backoffMsRef.current = Math.min(
        MAX_POLL_BACKOFF_MS,
        backoffMsRef.current * 2
      );
      return "retry";
    }
  }, [convoId, mergePolledUpdates]);

  useEffect(() => {
    let active = true;

    const clearTimer = () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const schedulePoll = () => {
      clearTimer();
      if (!active || document.visibilityState !== "visible") return;
      pollTimerRef.current = setTimeout(async () => {
        if (!active || document.visibilityState !== "visible") return;
        const status = await pollOnce();
        if (active && status !== "stop" && document.visibilityState === "visible") {
          schedulePoll();
        }
      }, backoffMsRef.current);
    };

    const start = async () => {
      const loaded = await loadInitialConversation();
      if (active && loaded && document.visibilityState === "visible") {
        schedulePoll();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pollOnce().then((status) => {
          if (active && status !== "stop") {
            schedulePoll();
          }
        });
      } else {
        clearTimer();
      }
    };

    void start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadInitialConversation, pollOnce]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convo?.messages.length]);

  const offersById = useMemo(() => {
    const map = new Map<string, Offer>();
    for (const offer of convo?.offers ?? []) {
      map.set(offer.id, offer);
    }
    return map;
  }, [convo?.offers]);

  const latestMsgIdForOffer = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of convo?.messages ?? []) {
      if (m.offer?.id) {
        map.set(m.offer.id, m.id);
      }
    }
    return map;
  }, [convo?.messages]);

  const activeAcceptedOffer = useMemo(() => {
    return (convo?.offers ?? []).find(
      (o) =>
        o.status === "ACCEPTED" &&
        (nowMs <= 0 || new Date(o.expiresAt).getTime() > nowMs)
    );
  }, [convo?.offers, nowMs]);

  const hasActivePendingOffer = useMemo(() => {
    return (convo?.offers ?? []).some(
      (o) =>
        o.status === "PENDING" &&
        (nowMs <= 0 || new Date(o.expiresAt).getTime() > nowMs)
    );
  }, [convo?.offers, nowMs]);

  const isBuyer = Boolean(viewerId && convo?.buyerId === viewerId);
  const isListingActive = !convo?.listing.status || convo.listing.status === "ACTIVE";

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSendingMsg) return;

    setIsSendingMsg(true);
    try {
      const res = await fetch(
        `/api/conversations/${encodeURIComponent(convoId)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        }
      );

      const json = (await res.json().catch(() => null)) as {
        message?: ChatMessage;
        cursor?: string;
        detail?: string;
        error?: string;
      } | null;

      if (!res.ok || !json?.message) {
        showToast(
          json?.detail || "Gagal mengirim pesan. Coba lagi sebentar.",
          "error"
        );
        setIsSendingMsg(false);
        return;
      }

      setInputText("");
      mergePolledUpdates(
        {
          data: [json.message],
        },
        false
      );
    } catch {
      showToast("Koneksi terputus saat mengirim pesan.", "error");
    } finally {
      setIsSendingMsg(false);
    }
  };

  const submitOfferAmount = async (amount: number) => {
    if (isOfferBusy) return false;
    setIsOfferBusy(true);
    try {
      const res = await fetch(
        `/api/conversations/${encodeURIComponent(convoId)}/offers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount }),
        }
      );

      const json = (await res.json().catch(() => null)) as {
        offer?: Offer;
        message?: ChatMessage;
        detail?: string;
      } | null;

      if (!res.ok || !json?.offer || !json?.message) {
        showToast(
          json?.detail || "Gagal mengajukan penawaran harga.",
          "error"
        );
        return false;
      }

      setConvo((prev) => {
        if (!prev) return prev;
        const offers = [json.offer!, ...(prev.offers ?? [])];
        const existingIds = new Set(prev.messages.map((m) => m.id));
        const messages = existingIds.has(json.message!.id)
          ? prev.messages
          : [...prev.messages, json.message!];
        return {
          ...prev,
          offers,
          messages,
          lastMessage: json.message!.text,
          lastTimestamp: json.message!.timestamp,
        };
      });
      showToast(`Penawaran ${formatRupiah(amount)} dikirim!`, "success");
      return true;
    } catch {
      showToast("Gagal mengirim penawaran karena masalah jaringan.", "error");
      return false;
    } finally {
      setIsOfferBusy(false);
    }
  };

  const handleOfferModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitOfferAmount(Math.trunc(offerAmountInput));
    if (ok) setOfferModalOpen(false);
  };

  const handleOfferAction = async (
    offerId: string,
    action: "accept" | "reject" | "counter",
    amount?: number
  ) => {
    if (isOfferBusy) return;
    setIsOfferBusy(true);
    try {
      const res = await fetch(
        `/api/conversations/${encodeURIComponent(convoId)}/offers/${encodeURIComponent(
          offerId
        )}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          ...(action === "counter"
            ? { body: JSON.stringify({ amount }) }
            : {}),
        }
      );

      const json = (await res.json().catch(() => null)) as {
        offer?: Offer;
        message?: ChatMessage;
        detail?: string;
      } | null;

      if (!res.ok || !json?.offer || !json?.message) {
        showToast(json?.detail || "Gagal memperbarui penawaran.", "error");
        void pollOnce();
        return;
      }

      setConvo((prev) => {
        if (!prev) return prev;
        const existingOffers = prev.offers ?? [];
        const updatedOffers = existingOffers.map((o) =>
          o.id === json.offer!.id ? json.offer! : o
        );
        const existingIds = new Set(prev.messages.map((m) => m.id));
        const messages = existingIds.has(json.message!.id)
          ? prev.messages
          : [...prev.messages, json.message!];
        return {
          ...prev,
          offers: updatedOffers,
          messages,
          lastMessage: json.message!.text,
          lastTimestamp: json.message!.timestamp,
        };
      });
      showToast(
        action === "accept"
          ? "Penawaran disetujui! Pembeli dapat checkout harga nego."
          : action === "reject"
          ? "Penawaran ditolak."
          : "Harga tanding berhasil dikirim ke pembeli.",
        "info"
      );
    } catch {
      showToast("Gagal menghubungi server saat memproses penawaran.", "error");
    } finally {
      setIsOfferBusy(false);
    }
  };

  const handleCheckoutWithOffer = (offer: Offer) => {
    if (!convo) return;
    addItem(convo.listing.id, offer.id);
    router.push(`/checkout?listingId=${encodeURIComponent(convo.listing.id)}`);
  };

  const handleDirectCheckout = () => {
    if (!convo) return;
    addItem(convo.listing.id);
    router.push(`/checkout?listingId=${encodeURIComponent(convo.listing.id)}`);
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="h-16 rounded-2xl bg-surface-subtle animate-pulse" />
        <div className="h-96 rounded-2xl bg-surface-subtle animate-pulse" />
      </div>
    );
  }

  if (accessDenied === "UNAUTHORIZED") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <Lock className="w-10 h-10 text-brand-primary" />
        <h2 className="font-extrabold text-lg text-on-surface">
          Silakan Login untuk Mengakses Percakapan
        </h2>
        <Link href={`/login?next=/chat/${encodeURIComponent(convoId)}`}>
          <Button variant="primary" size="md">
            Masuk ke Akun
          </Button>
        </Link>
      </div>
    );
  }

  if (accessDenied || loadError || !convo || !viewerId) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <AlertCircle className="w-10 h-10 text-brand-danger" />
        <h2 className="font-bold text-lg text-on-surface">
          {accessDenied === "FORBIDDEN"
            ? "Akses Percakapan Ditolak"
            : loadError || "Percakapan Tidak Ditemukan"}
        </h2>
        <p className="text-xs text-text-secondary">
          {accessDenied === "FORBIDDEN"
            ? "Hanya pembeli dan penjual terkait yang dapat melihat atau mengirim pesan di ruang ini."
            : "Obrolan tidak tersedia atau telah dihapus."}
        </p>
        <Link href="/chat">
          <Button variant="primary" size="sm">
            Kembali ke Daftar Chat
          </Button>
        </Link>
      </div>
    );
  }

  const coverImg =
    convo.listing.images[0] || "/assets/products/ipad-mini-unboxing.png";

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 pt-3 pb-24 sm:pb-6 flex flex-col h-[calc(100vh-80px)]">
      {/* Header Counterpart Info */}
      <div className="bg-white p-3 sm:p-4 rounded-t-2xl border border-surface-border flex items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/chat"
            className="w-8 h-8 rounded-xl bg-surface-subtle hover:bg-outline-variant flex items-center justify-center text-text-secondary shrink-0"
            aria-label="Kembali ke inbox"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-brand-primary-soft shrink-0">
            <Image
              src={convo.counterpart.avatar}
              alt={convo.counterpart.name}
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm text-on-surface truncate">
                {convo.counterpart.name}
              </h1>
              {convo.counterpart.verifiedKYC && (
                <ShieldCheck className="w-3.5 h-3.5 text-brand-secondary shrink-0" />
              )}
            </div>
            <span className="text-[11px] text-text-muted">
              {isBuyer ? "Penjual" : "Pembeli"} • {convo.counterpart.location}
            </span>
          </div>
        </div>
      </div>

      {/* Linked Product Sticky Context Strip */}
      <div className="bg-surface-subtle border-x border-b border-surface-border p-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <Link
          href={`/product/${convo.listing.slug}`}
          className="flex items-center gap-2.5 min-w-0 flex-1 group"
        >
          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white shrink-0 border border-surface-border">
            <Image
              src={coverImg}
              alt={convo.listing.title}
              fill
              unoptimized={coverImg.startsWith("/api/")}
              sizes="48px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-xs text-on-surface truncate group-hover:text-brand-primary transition-colors">
              {convo.listing.title}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-extrabold text-xs text-brand-primary tabular-nums">
                {formatRupiah(convo.listing.price)}
              </span>
              {!isListingActive && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                  {convo.listing.status}
                </span>
              )}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {isBuyer && convo.listing.canNego && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isListingActive || hasActivePendingOffer || isOfferBusy}
              onClick={() => setOfferModalOpen(true)}
              className="text-xs font-bold gap-1"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>
                {hasActivePendingOffer ? "Menunggu Seller" : "Tawar Harga"}
              </span>
            </Button>
          )}

          {isBuyer &&
            (activeAcceptedOffer && isListingActive ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleCheckoutWithOffer(activeAcceptedOffer)}
                className="text-xs font-bold gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  Beli Sekarang (Harga Nego{" "}
                  {formatRupiah(activeAcceptedOffer.offerPrice)})
                </span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!isListingActive}
                onClick={handleDirectCheckout}
                className="text-xs font-bold gap-1"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>
                  {isListingActive ? "Beli Sekarang" : convo.listing.status}
                </span>
              </Button>
            ))}
        </div>
      </div>

      {/* Chat Messages Thread */}
      <div className="flex-1 bg-white border-x border-surface-border overflow-y-auto p-4 space-y-3">
        {convo.messages.length === 0 ? (
          <div className="text-center py-12 text-xs text-text-muted">
            Belum ada pesan. Mulailah bertanya kondisi unit atau mengajukan
            penawaran harga.
          </div>
        ) : (
          convo.messages.map((msg) => {
            const isMe = msg.senderId === viewerId;
            const syncedOffer = msg.offer
              ? offersById.get(msg.offer.id) ?? msg.offer
              : undefined;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  isMe ? "items-end" : "items-start"
                } gap-1.5`}
              >
                {syncedOffer ? (
                  <OfferCard
                    offer={syncedOffer}
                    listing={convo.listing}
                    viewerId={viewerId}
                    nowMs={nowMs}
                    isLatestForOffer={
                      latestMsgIdForOffer.get(syncedOffer.id) === msg.id
                    }
                    hasActivePendingOffer={hasActivePendingOffer}
                    isBusy={isOfferBusy}
                    onAccept={(id) => handleOfferAction(id, "accept")}
                    onReject={(id) => handleOfferAction(id, "reject")}
                    onCounter={(id, amount) =>
                      handleOfferAction(id, "counter", amount)
                    }
                    onBuyNegotiated={handleCheckoutWithOffer}
                    onAcceptCounterAsBuyer={async (amount) => {
                      await submitOfferAmount(amount);
                    }}
                  />
                ) : (
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                      isMe
                        ? "bg-brand-primary text-white rounded-br-sm"
                        : "bg-surface-subtle text-on-surface rounded-bl-sm border border-surface-border"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    <span
                      className={`block text-[10px] mt-1 text-right ${
                        isMe ? "text-white/75" : "text-text-muted"
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <form
        onSubmit={handleSendMessage}
        className="bg-white p-3 rounded-b-2xl border border-surface-border flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          maxLength={1000}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Tulis pesan ke penjual/pembeli..."
          aria-label="Tulis pesan chat"
          className="flex-1 h-11 px-4 rounded-xl bg-surface-subtle text-xs sm:text-sm text-on-surface border border-transparent focus:border-brand-primary focus:bg-white outline-none"
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!inputText.trim() || isSendingMsg}
          className="h-11 px-4 font-bold gap-1.5 shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Kirim</span>
        </Button>
      </form>

      {/* Offer Submission Modal */}
      <Modal
        isOpen={offerModalOpen}
        onClose={() => setOfferModalOpen(false)}
        title="Ajukan Penawaran Harga"
        description="Jika disetujui penjual, harga terkunci selama 24 jam khusus untuk akunmu."
      >
        <form onSubmit={handleOfferModalSubmit} className="flex flex-col gap-4">
          <div className="p-3 rounded-xl bg-surface-subtle text-xs">
            <span className="text-text-muted">Harga Listing Saat Ini: </span>
            <strong className="text-on-surface">
              {formatRupiah(convo.listing.price)}
            </strong>
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface block mb-1">
              Nominal Tawaran (Rp):
            </label>
            <input
              type="number"
              min={1}
              max={convo.listing.price}
              value={offerAmountInput}
              onChange={(e) => setOfferAmountInput(Number(e.target.value))}
              className="w-full h-11 px-3 rounded-xl bg-surface-subtle text-base font-mono font-bold text-on-surface border border-transparent focus:border-brand-primary focus:bg-white outline-none"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            {[0.95, 0.9, 0.85].map((ratio) => {
              const val = Math.round(convo.listing.price * ratio);
              return (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setOfferAmountInput(val)}
                  className="flex-1 py-1.5 rounded-lg bg-surface-subtle text-xs font-semibold text-text-secondary hover:bg-outline-variant"
                >
                  -{Math.round((1 - ratio) * 100)}% ({formatRupiah(val)})
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOfferModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={isOfferBusy}>
              Kirim Penawaran
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
