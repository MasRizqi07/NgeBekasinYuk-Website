"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  Star,
  ExternalLink,
  Tag,
  Send,
  CheckCircle2,
  Lock,
  Clock,
  Check,
  X,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { useChatStore } from "@/stores/useChatStore";
import { useCartStore } from "@/stores/useCartStore";
import { SEED_LISTINGS } from "@/lib/seedData";
import { formatRupiah } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import confetti from "canvas-confetti";

export default function ChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const convoId = params.id as string;
  const {
    getConversationById,
    sendMessage,
    sendOffer,
    acceptOffer,
    rejectOffer,
    isCounterpartTyping,
  } = useChatStore();
  const { addToCart } = useCartStore();
  const { showToast } = useToast();

  const [inputText, setInputText] = useState("");
  const [showNegoModal, setShowNegoModal] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [customOfferPrice, setCustomOfferPrice] = useState<number>(6900000);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversation = getConversationById(convoId) || {
    id: convoId,
    listingId: (SEED_LISTINGS[1] || SEED_LISTINGS[0]).id,
    counterpart: {
      id: "usr-dimas",
      name: "Dimas Aditya",
      avatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuARVSFYfBWVyVsZWQluSJcL8sMPOSmnE8mGkR5BrhkwbubbuXak0j5WwkwOo1JjgKnpaf1S7WJRcRm1ZicytLS3wpBG9CPYS6LiOOXaybKow8Ho4_EogUn5YXqk4IUoQo8UdYN600NliLjnIDlOjB89sEfXd_98btgCRMHw7HE1wvgfQtQkXwX7m6c2tCpX9IqBNbnhP4Nb57GCNuHtQ2ESg9gUjeUIvzWs7RV27u5YUKcspnWFxF1e",
      isOnline: true,
      isVerified: true,
      city: "Jakarta Barat",
    },
    listing: SEED_LISTINGS[1] || SEED_LISTINGS[0],
    lastMessage: "Harga penawarannya sudah saya acc ya kak!",
    lastTimestamp: new Date().toISOString(),
    unreadCount: 0,
    messages: [],
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages, isCounterpartTyping]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    sendMessage(conversation.id, inputText.trim());
    setInputText("");
  };

  const handleCreateOffer = () => {
    sendOffer(conversation.id, customOfferPrice);
    setShowNegoModal(false);
    showToast(`Penawaran ${formatRupiah(customOfferPrice)} berhasil diajukan!`, "info");
  };

  const handleAcceptOffer = (offerId: string) => {
    acceptOffer(conversation.id, offerId);
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 },
    });
    showToast("Tawaran diterima! Harga khusus terkunci 2 jam.", "success");
  };

  const handleCheckoutAgreedPrice = (price: number) => {
    addToCart(conversation.listing, price);
    showToast("Harga negosiasi berhasil diterapkan ke keranjang!", "success");
    router.push("/checkout");
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-28">
      {/* Pinned Subheader */}
      <div className="sticky top-0 z-30 bg-surface-container-lowest/95 backdrop-blur-xl border-b border-outline-variant/30 shadow-xs">
        {/* Partner Info Row */}
        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              onClick={() => router.push("/chat")}
              className="w-9 h-9 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container relative">
                <Image
                  src={
                    conversation.counterpart.avatar ||
                    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
                  }
                  alt={conversation.counterpart.name}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </div>
              {conversation.counterpart.isOnline && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-secondary rounded-full border-2 border-surface-container-lowest"></span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs md:text-sm text-on-surface truncate">
                  {conversation.counterpart.name}
                </span>
                {conversation.counterpart.isVerified && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3 text-secondary" />
                    <span>KYC</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-on-surface-variant text-[11px]">
                <span className="text-secondary font-semibold">Online</span>
                <span>•</span>
                <span>Balas &lt;5 mnt</span>
                <span>•</span>
                <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span>4.9 (52)</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowSafetyModal(true)}
              className="h-8 px-2.5 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center gap-1 text-primary text-xs font-bold transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tips Aman</span>
            </button>
          </div>
        </div>

        {/* Pinned Product Listing Context Strip */}
        <div className="px-4 py-2 bg-surface-container-low/70 border-t border-outline-variant/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container shrink-0 relative border border-outline-variant/20">
              <Image
                src={conversation.listing.images[0] || "/assets/products/ipad-mini-unboxing.png"}
                alt={conversation.listing.title}
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs text-on-surface truncate font-semibold">
                {conversation.listing.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold text-primary">
                  {formatRupiah(conversation.listing.price)}
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-700 text-[10px] uppercase font-bold">
                  Bisa Nego
                </span>
              </div>
            </div>
          </div>

          <Link
            href={`/product/${conversation.listing.slug}`}
            className="shrink-0 px-2.5 py-1 rounded-full bg-surface-container-lowest text-primary hover:bg-surface-container text-xs font-semibold shadow-xs flex items-center gap-1 transition-colors"
          >
            <span>Detail</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 space-y-4">
        {/* Date Divider */}
        <div className="flex justify-center">
          <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-medium">
            Hari Ini • Terenkripsi End-to-End
          </span>
        </div>

        {/* Escrow Banner Guard */}
        <div className="p-3 rounded-2xl bg-secondary-fixed/40 text-on-secondary-fixed flex items-start gap-2.5 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-secondary">Tips Keamanan Rekber Escrow: </span>
            <span>
              Wajib transaksi via escrow resmi <strong>NgeBekasinYuk</strong>. Jangan pernah transfer langsung ke rekening pribadi untuk melindungi jaminan retur barang 2x24 jam.
            </span>
          </div>
        </div>

        {/* Render Conversation Messages */}
        {conversation.messages.map((msg) => {
          const isMe = msg.senderId === "user-budi";

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? "items-end self-end" : "items-start self-start"} max-w-[85%]`}
            >
              {/* If message has an Offer attached */}
              {msg.offer ? (
                <div className="w-full my-1">
                  {msg.offer.status === "ACCEPTED" ? (
                    <div className="bg-secondary-fixed/30 border border-secondary/30 rounded-2xl p-4 shadow-sm space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-secondary text-on-secondary flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-secondary leading-tight">
                            Tawaran Disetujui Penjual!
                          </h4>
                          <span className="text-[11px] text-on-surface-variant">
                            Harga khusus telah disepakati
                          </span>
                        </div>
                      </div>

                      <div className="bg-surface-container-lowest p-3 rounded-xl space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span>Harga Kesepakatan:</span>
                          <span className="font-bold text-base text-secondary">
                            {formatRupiah(msg.offer.offerPrice)}
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant">
                          Harga terkunci untuk akun kamu hingga 2 jam ke depan.
                        </p>
                      </div>

                      <button
                        onClick={() => handleCheckoutAgreedPrice(msg.offer!.offerPrice)}
                        className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-primary/90 transition-all"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>Checkout {formatRupiah(msg.offer.offerPrice)} Sekarang</span>
                      </button>
                    </div>
                  ) : msg.offer.status === "REJECTED" ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5 text-xs text-red-700 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <X className="w-4 h-4 text-red-600" />
                        <span>Penawaran Ditolak</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">
                        Penawaran seharga {formatRupiah(msg.offer.offerPrice)} belum disepakati. Silakan ajukan nominal baru.
                      </p>
                    </div>
                  ) : (
                    /* PENDING OFFER */
                    <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-primary text-xs font-bold">
                          <Tag className="w-4 h-4" />
                          <span>Penawaran Harga Diajukan</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 text-[10px] font-bold">
                          Berlaku 24 Jam
                        </span>
                      </div>

                      <div className="bg-surface-container-lowest p-3 rounded-xl space-y-1 text-xs">
                        <div className="flex justify-between text-on-surface-variant">
                          <span>Harga Asli Listing:</span>
                          <span className="line-through">{formatRupiah(msg.offer.originalPrice)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 font-bold">
                          <span className="text-on-surface">Harga Tawaran:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 rounded bg-secondary-fixed text-on-secondary-fixed text-[10px]">
                              -{msg.offer.discountPercent}%
                            </span>
                            <span className="text-primary text-sm font-bold">
                              {formatRupiah(msg.offer.offerPrice)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Buyer perspective or Seller interactive buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => rejectOffer(conversation.id, msg.offer!.id)}
                          className="py-2 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container text-error text-xs font-bold transition-all"
                        >
                          Tolak
                        </button>
                        <button
                          onClick={() => handleAcceptOffer(msg.offer!.id)}
                          className="py-2 px-3 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Terima Tawaran</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Standard Message Bubble */
                <div
                  className={`p-3.5 rounded-2xl shadow-xs space-y-1 text-xs leading-relaxed ${
                    isMe
                      ? "bg-primary text-on-primary rounded-tr-xs"
                      : "bg-surface-container-lowest text-on-surface rounded-tl-xs border border-outline-variant/20"
                  }`}
                >
                  <p>{msg.text}</p>
                  <div
                    className={`flex items-center justify-end gap-1 text-[10px] ${
                      isMe ? "text-primary-fixed" : "text-on-surface-variant"
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {isMe && <Check className="w-3 h-3" />}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Counterpart Typing Indicator */}
        {isCounterpartTyping && (
          <div className="flex items-center gap-2 self-start bg-surface-container-lowest px-3 py-2 rounded-2xl rounded-tl-xs border border-outline-variant/20 shadow-xs">
            <span className="text-xs text-on-surface-variant font-medium">
              {conversation.counterpart.name} sedang mengetik
            </span>
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sticky Bottom Message & Negotiation Input Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest border-t border-outline-variant/30 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] pb-safe">
        <form
          onSubmit={handleSend}
          className="max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-2"
        >
          {/* Nego Trigger Button */}
          <button
            type="button"
            onClick={() => setShowNegoModal(true)}
            className="h-10 px-3 rounded-full bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all active:scale-95"
          >
            <Tag className="w-4 h-4 text-amber-600" />
            <span>Tawar</span>
          </button>

          {/* Text Input */}
          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Ketik pesan untuk ${conversation.counterpart.name}...`}
              className="w-full bg-surface-container-low text-on-surface placeholder:text-outline-variant text-xs pl-4 pr-10 py-2.5 rounded-full focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-inner"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 text-on-primary flex items-center justify-center shrink-0 shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Negotiation Drawer Modal */}
      <Modal
        isOpen={showNegoModal}
        onClose={() => setShowNegoModal(false)}
        title="Ajukan Penawaran Harga Baru"
      >
        <div className="space-y-4 text-xs">
          <div className="bg-surface-container-low p-3 rounded-xl flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-container shrink-0 relative">
              <Image
                src={conversation.listing.images[0] || "/assets/products/ipad-mini-unboxing.png"}
                alt={conversation.listing.title}
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-xs text-on-surface truncate">
                {conversation.listing.title}
              </p>
              <p className="text-on-surface-variant text-[11px]">
                Harga Listing:{" "}
                <span className="font-bold text-on-surface">
                  {formatRupiah(conversation.listing.price)}
                </span>
              </p>
            </div>
          </div>

          {/* Quick preset chips */}
          <div className="space-y-1.5">
            <label className="font-bold text-on-surface">Pilih Cepat Persentase Nego:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { pct: 5, price: Math.round(conversation.listing.price * 0.95) },
                { pct: 8, price: Math.round(conversation.listing.price * 0.92) },
                { pct: 10, price: Math.round(conversation.listing.price * 0.9) },
              ].map((item) => (
                <button
                  key={item.pct}
                  type="button"
                  onClick={() => setCustomOfferPrice(item.price)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all text-center border ${
                    customOfferPrice === item.price
                      ? "bg-primary text-on-primary border-primary shadow-xs"
                      : "bg-surface-container-low text-on-surface border-outline-variant/30 hover:bg-surface-container"
                  }`}
                >
                  -{item.pct}% ({formatRupiah(item.price)})
                </button>
              ))}
            </div>
          </div>

          {/* Custom Nominal Input */}
          <div className="space-y-1">
            <label className="font-bold text-on-surface">Nominal Penawaran (Rp)</label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-on-surface-variant font-bold text-sm">
                Rp
              </span>
              <input
                type="number"
                value={customOfferPrice}
                onChange={(e) => setCustomOfferPrice(Number(e.target.value))}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-bold text-base focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Penjual dapat menyetujui, menolak, atau memberikan penawaran balik.
            </p>
          </div>

          {/* Rekber Info */}
          <div className="p-3 rounded-xl bg-secondary-fixed/40 text-on-secondary-fixed flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-secondary shrink-0" />
            <span>Penawaran mengikat selama 24 jam dengan proteksi Rekber resmi.</span>
          </div>

          <button
            onClick={handleCreateOffer}
            className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-xs hover:bg-primary/90 transition-all"
          >
            Kirim Penawaran {formatRupiah(customOfferPrice)}
          </button>
        </div>
      </Modal>

      {/* Safety Tips Modal */}
      <Modal
        isOpen={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        title="Panduan Transaksi Aman & SOP Rekber"
      >
        <div className="space-y-3 text-xs text-on-surface-variant leading-relaxed">
          <div className="flex items-start gap-2.5 bg-surface-container-low p-3 rounded-xl">
            <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <strong className="text-on-surface">Gunakan Sistem Escrow Resmi:</strong>
              <p>Jangan pernah transfer langsung ke rekening pribadi di luar platform.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 bg-surface-container-low p-3 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
            <div>
              <strong className="text-on-surface">Wajib Video Unboxing 360°:</strong>
              <p>Rekam video pembukaan paket tanpa jeda memperlihatkan resi kurir dan fisik unit.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 bg-surface-container-low p-3 rounded-xl">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-on-surface">Masa Inspeksi 2x24 Jam:</strong>
              <p>Uji layar, sensor, kamera, baterai, dan IMEI sebelum menyetujui pencairan dana.</p>
            </div>
          </div>
          <button
            onClick={() => setShowSafetyModal(false)}
            className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 transition-all mt-2"
          >
            Saya Mengerti
          </button>
        </div>
      </Modal>
    </div>
  );
}
