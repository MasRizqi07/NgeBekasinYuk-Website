"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  MoreVertical,
  Clock,
  Copy,
  Check,
  Lock,
  AlertTriangle,
  Play,
  Upload,
  MessageSquare,
  Send,
  Headphones,
  FileText,
  UserCheck,
  Shield,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { useDisputeStore } from "@/stores/useDisputeStore";
import { formatRupiah, copyTextToClipboard } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";

export default function DisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const disputeId = params.id as string;
  const { getDisputeById, addDiscussionMessage, submitSellerEvidence } = useDisputeStore();
  const { showToast } = useToast();

  const [copiedTicket, setCopiedTicket] = useState(false);
  const [selectedSolution, setSelectedSolution] = useState<"retur" | "partial">("retur");
  const [replyText, setReplyText] = useState("");
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [activeMediaPreview, setActiveMediaPreview] = useState<string | null>(null);

  // SLA countdown simulation
  const [slaSeconds, setSlaSeconds] = useState(160318); // ~44h 31m 58s

  useEffect(() => {
    const timer = setInterval(() => {
      setSlaSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dispute = getDisputeById(disputeId) || {
    id: disputeId || "DSP-2026-88421",
    orderId: "STX-2026-0701",
    listingTitle: "MacBook Air M1 256GB Space Grey",
    listingPrice: 8500000,
    listingImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBkWG7Sz_sUpraniQ69WX24MQTgqzorNsedCM66Z-sAMVmJbe_erxsIGGuTRROnbNvph-GsH2BZ7rnMOL7FSTITdrGVQo8_U6GEm6QBSHAF1q7pSumvADjrnkgttEQ6UKQNOypMwiGv3NlE_6tw9gMw-V-d8otWmEQRmrBw-LyTETWOdynPL-0hvHzF4RC-z_2q3ATU_A85QDbaqBhFXkP5kgeO-LiWi0f1SIilqhPyllSbhDkIpeRD",
    buyerName: "Budi Pratama",
    sellerName: "Dimas Aditya",
    reason: "ITEM_DEFECT",
    description:
      "Barang baru saya unboxing dan nyalakan, langsung muncul garis hijau vertikal dari atas ke bawah. Padahal deskripsi seller bilang 100% mulus tanpa minus. Saya minta retur dan 100% dana refund.",
    buyerEvidencePhotos: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC29jtC_g0E8Ebu_0X4RWyAjiWKVVbrwQBZjg4Z35UDWY2XYISvdNz76TUKSqj8FiIOxf7RaugyG36NPyRj8jvTJ_qubPB_cafSCuPwFWHSHCA6Nc5QNKK9HqYzDTgquKbcTAbrNXxLJp6XsGVgRuk6h3X3m_Xhr5Ym5BBt8sbBCNnzmAVS_1r4cc4cvSURBmWqNUtl2Ci0zLYaLCE0bg8q4jaNl68OKc7f0tnbaY0Syfwb_m8M9TTM",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuADJHdHoyGrplpYiGTM0G5PWFyl7YY1M3LzSPsGyH-nWXg10VsvC0pvteWqygLY0Lt_7OfXUfHVb-L4D-12qSZPxThhXfYg3_bcJK3Mk5ueDKKq3uzF2z9nDGjOjpOy46RTRV_YiCqHGzZSH9c6kvIoWKAB7qnbCshhV6dnyNSAXGgdFViWYjtxNcaAjg-My-5KGNWDbiIbqgm4v7ovF3zARGh60u-QmsidMbcK1IV4nu-gf05U3xnx",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD0ofur9hFBK0U3j6tEgiJjb5gjswyMlqeXfbSEU__gf5cm8pxp0Urt5NVtKkoqziUR9_2pB-lcpwyOLoFQt-uxQ66d6ASIh8Jx-11eCcBEBCUSiCayzO62WeZjeIoOWkoxayONvEtl9RI7QoIDSX0RroE2NAMDp_O2a8q3JkhQMmJsi4EbSl7eOa-3Sw8hgnfntYKZf1xqWx1grQ4acgWC_nXN0xtv3ZjJRaRGd-e8Mr7bgi29oB3G",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB-wyzoqKJA0VQmGiRLx_kh3nWaxMxuqRu2Bt_zJlwx_V4KkQnSdigCfIehMRFzCuF_ujC2l8u1xhu4Pd1mNMKwGNoVc5PW8lAp4YquBYqZYIrpyEOQL7iJ3_7V4TIyo9IWFcGXof_bjIDCFRkaWNH05JiGUJ9gIAXMX8FrwJLcdGDGkMbb0BBF7-TUz30GwENr5fGHvLI0E1tgHoiJJGEk-4FZXwZS-zh5cnLjd9mez04_Kt6I5J2l",
    ],
    sellerEvidencePhotos: [],
    status: "AWAITING_SELLER",
    messages: [
      {
        id: "m1",
        author: "Sarah L. (Admin Mediasi)",
        role: "ADMIN",
        text: "Halo Budi dan Dimas. Tiket sengketa resmi dibuka. Dana transaksi senilai Rp 8.500.000 telah dibekukan sementara di escrow. Silakan pihak penjual (@Dimas Aditya) mengunggah video serial number dan pengujian fungsi layar sebelum paket diserahkan ke J&T Express dalam 44 jam ke depan.",
        timestamp: "10:25 WIB",
      },
      {
        id: "m2",
        author: "Budi Pratama (Pembeli)",
        role: "BUYER",
        text: "Baik Mbak Admin, video unboxing sudah saya sertakan di atas. Direkam lengkap tanpa jeda mulai dari paket utuh segel lakban sampai macbook dinyalakan pertama kali. Saya siap retur jika seller tidak mau opsi kompensasi LCD.",
        timestamp: "10:38 WIB",
      },
    ],
  };

  const hours = Math.floor(slaSeconds / 3600);
  const minutes = Math.floor((slaSeconds % 3600) / 60);
  const seconds = slaSeconds % 60;

  const handleCopyTicket = async () => {
    const ok = await copyTextToClipboard(dispute.id);
    if (ok) {
      setCopiedTicket(true);
      showToast("Nomor tiket berhasil disalin", "success");
      setTimeout(() => setCopiedTicket(false), 2000);
    }
  };

  const handleSendReply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim()) return;

    addDiscussionMessage(
      dispute.id,
      "Budi Pratama (Pembeli)",
      "BUYER",
      replyText.trim()
    );
    setReplyText("");
    setShowReplyModal(false);
    showToast("Tanggapan berhasil dikirim ke ruang mediasi", "success");
  };

  const handleUploadSellerQC = () => {
    const dummyProof =
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAlbpPzbHjOZiSoCv0_U4dYHqpJufGFpLVzrWBf2mmxd9iPP2XTgW5n376JZNxhO8hzgVfHzccltMxBeKKp7WBb6bypX2yY1yQEoaZz-cXWc75yNPUuS1A6Cz_me5Jr9LcsjFQIm5GCHAxFCbBXkVYn94veaZmlz0Rhx7hXnZktF2iCyKPKeubQz89fYKNU1077usOkwXqdGbT5V2VpQTtYI4V9tKCOrR8FJw8hIxNYjy6n-byCdVA9";
    submitSellerEvidence(dispute.id, [dummyProof]);
    showToast("Bukti QC Penjual berhasil diunggah! Status berubah ke UNDER_REVIEW", "success");
  };

  return (
    <div className="min-h-screen bg-surface pb-32 pt-4">
      <div className="max-w-xl mx-auto px-4 space-y-4">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between py-2">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center text-center">
            <h1 className="font-bold text-headline-sm text-on-surface">Pusat Mediasi Sengketa</h1>
            <div className="flex items-center gap-1 text-secondary font-bold text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Escrow Freeze Active</span>
            </div>
          </div>
          <Link
            href="/help/escrow"
            className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
          </Link>
        </div>

        {/* SLA Countdown Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-700">
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Batas Waktu Mediasi Tahap 1
              </span>
            </div>
            <span className="font-mono font-bold text-xs text-amber-800">
              {hours}j : {String(minutes).padStart(2, "0")}m : {String(seconds).padStart(2, "0")}s
            </span>
          </div>
          <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-600 h-full rounded-full transition-all duration-500 w-[72%]"></div>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            Penjual wajib menanggapi &amp; mengunggah rekaman video QC packing sebelum batas SLA berakhir.
          </p>
        </div>

        {/* Ticket Meta Pill Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1 rounded-full border border-outline-variant/20">
              <span className="text-xs text-on-surface-variant font-medium">Tiket:</span>
              <span className="font-mono font-bold text-xs text-primary">{dispute.id}</span>
              <button
                onClick={handleCopyTicket}
                className="text-on-surface-variant hover:text-primary transition-colors ml-1"
              >
                {copiedTicket ? <Check className="w-3.5 h-3.5 text-secondary" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <span className="bg-amber-500/10 text-amber-700 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>
                {dispute.status === "AWAITING_SELLER"
                  ? "Menunggu Bukti Penjual"
                  : dispute.status === "UNDER_REVIEW"
                  ? "Sedang Direview Mediator"
                  : dispute.status === "RESOLVED_BUYER"
                  ? "Selesai (Refund Pembeli)"
                  : "Selesai (Diteruskan Penjual)"}
              </span>
            </span>
          </div>

          {/* Secure Escrow Custody Banner */}
          <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-on-secondary shrink-0 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-xs min-w-0">
              <div className="flex items-center gap-1 font-bold text-secondary text-xs">
                <span>Dana {formatRupiah(dispute.listingPrice)} Terkunci Aman</span>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <p className="text-on-surface-variant mt-0.5 leading-relaxed">
                Kustodian Resmi PT NgeBekasin Nusantara. Saldo dibekukan dan tidak akan cair ke penjual sampai investigasi selesai atau disepakati kedua pihak.
              </p>
            </div>
          </div>
        </div>

        {/* Order & Product Snapshot */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-on-surface-variant border-b border-outline-variant/20 pb-2">
            <span className="uppercase tracking-wider font-semibold">Detail Pesanan Rekber</span>
            <span className="font-mono font-bold text-on-surface">#{dispute.orderId}</span>
          </div>
          <div className="flex gap-3 items-center">
            <div className="w-16 h-16 rounded-xl bg-surface-container overflow-hidden shrink-0 relative border border-outline-variant/20">
              <Image
                src={dispute.listingImage || "/assets/products/ipad-mini-unboxing.png"}
                alt={dispute.listingTitle}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <h2 className="font-bold text-sm text-on-surface truncate">
                {dispute.listingTitle}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="bg-surface-container-high px-1.5 py-0.5 rounded text-[11px] font-medium">
                  Mulus 99%
                </span>
                <span className="font-bold text-primary">
                  {formatRupiah(dispute.listingPrice)}
                </span>
              </div>
            </div>
          </div>

          {/* Parties Involved */}
          <div className="grid grid-cols-2 gap-2 bg-surface-container-low p-2.5 rounded-xl text-xs">
            <div>
              <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                Pembeli (Pelapor)
              </span>
              <div className="flex items-center gap-1 font-bold text-on-surface mt-0.5">
                <span>{dispute.buyerName}</span>
                <UserCheck className="w-3.5 h-3.5 text-secondary" />
              </div>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                Penjual (Terlapor)
              </span>
              <div className="flex items-center gap-1 font-bold text-on-surface mt-0.5">
                <span>{dispute.sellerName}</span>
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              </div>
            </div>
          </div>
        </div>

        {/* Claim & Evidence Section */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-red-600 font-bold text-xs">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="text-on-surface">Klaim Cacat oleh Pembeli</h3>
            </div>
            <span className="text-[11px] text-on-surface-variant">Hari ini, 10:14 WIB</span>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs">
            <span className="font-bold text-red-800 block mb-0.5">
              Masalah: {dispute.reason === "ITEM_DEFECT" ? "Layar Garis Hijau (Greenline Defect)" : dispute.reason}
            </span>
            <p className="text-on-surface-variant leading-relaxed">{dispute.description}</p>
          </div>

          {/* Horizontal Evidence Gallery */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-on-surface">
                Lampiran Bukti Pembeli ({dispute.buyerEvidencePhotos.length} File)
              </span>
              <span className="text-[11px] text-primary">Ketuk untuk Memperbesar</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {dispute.buyerEvidencePhotos.map((photo, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveMediaPreview(photo)}
                  className="relative w-28 h-20 rounded-xl overflow-hidden bg-surface-container shrink-0 cursor-pointer group shadow-xs border border-outline-variant/20"
                >
                  <Image src={photo} alt={`Evidence ${idx + 1}`} fill sizes="112px" className="object-cover" />
                  {idx === 0 && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white">
                      <Play className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-bold bg-black/60 px-1 rounded mt-0.5">
                        03:42 Min
                      </span>
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1 rounded">
                    {idx === 0
                      ? "Unboxing"
                      : idx === 1
                      ? "Garis Hijau"
                      : idx === 2
                      ? "Cek SN Dus"
                      : "Kardus Resi"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Seller Response Section & Dropzone */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-on-surface">
              <Shield className="w-4 h-4 text-primary" />
              <span>Tanggapan &amp; Bukti QC Penjual</span>
            </div>
            <span className="bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {dispute.sellerEvidencePhotos.length > 0 ? "Sudah Diunggah" : "Pending"}
            </span>
          </div>

          {dispute.sellerEvidencePhotos.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface-container-low flex flex-col items-center text-center gap-1.5 text-xs">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-0.5">
                <Upload className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-on-surface">Unggah Bukti QC &amp; Video Packing</h4>
              <p className="text-on-surface-variant max-w-xs text-[11px]">
                Kirimkan video sebelum paket dikirim yang menampilkan fungsi layar menyala normal &amp; segel anti-tamper.
              </p>
              <button
                onClick={handleUploadSellerQC}
                className="mt-1 bg-primary text-on-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-primary/90 transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Simulasi Unggah Bukti QC Penjual</span>
              </button>
            </div>
          ) : (
            <div className="p-3 bg-secondary-fixed/30 rounded-xl text-xs text-on-secondary-fixed flex items-center justify-between">
              <span className="font-bold">1 Video QC Penjual Telah Terlampir</span>
              <span className="text-[11px] text-secondary font-semibold">Diverifikasi Sistem</span>
            </div>
          )}
        </div>

        {/* Settlement Proposals / Pilihan Opsi Mediasi */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <h3 className="font-bold text-on-surface">Opsi Solusi Rekomendasi Mediator</h3>
            <span className="text-secondary font-bold text-[11px]">2 Pilihan Terbuka</span>
          </div>

          {/* Option A */}
          <label
            onClick={() => setSelectedSolution("retur")}
            className={`cursor-pointer rounded-xl p-3 flex items-start gap-3 border transition-colors ${
              selectedSolution === "retur"
                ? "bg-primary/5 border-primary"
                : "bg-surface-container-low border-transparent hover:bg-surface-container"
            }`}
          >
            <input
              type="radio"
              name="solution"
              checked={selectedSolution === "retur"}
              onChange={() => setSelectedSolution("retur")}
              className="mt-1 accent-primary w-4 h-4"
            />
            <div className="text-xs flex flex-col min-w-0">
              <span className="font-bold text-on-surface">
                Opsi A: Retur Penuh &amp; Refund 100%
              </span>
              <p className="text-on-surface-variant mt-0.5 leading-relaxed">
                Unit dikirim kembali ke penjual. Dana{" "}
                <strong className="text-on-surface">{formatRupiah(dispute.listingPrice)}</strong>{" "}
                dikembalikan penuh ke saldo pembeli setelah unit tiba di alamat seller. Ongkir retur ditanggung penjual.
              </p>
            </div>
          </label>

          {/* Option B */}
          <label
            onClick={() => setSelectedSolution("partial")}
            className={`cursor-pointer rounded-xl p-3 flex items-start gap-3 border transition-colors ${
              selectedSolution === "partial"
                ? "bg-primary/5 border-primary"
                : "bg-surface-container-low border-transparent hover:bg-surface-container"
            }`}
          >
            <input
              type="radio"
              name="solution"
              checked={selectedSolution === "partial"}
              onChange={() => setSelectedSolution("partial")}
              className="mt-1 accent-primary w-4 h-4"
            />
            <div className="text-xs flex flex-col min-w-0">
              <span className="font-bold text-on-surface">
                Opsi B: Kompensasi Servis LCD (Refund Parsial)
              </span>
              <p className="text-on-surface-variant mt-0.5 leading-relaxed">
                Pembeli tetap menyimpan laptop. Penjual setuju mentransfer refund kompensasi sebesar{" "}
                <strong className="text-primary font-bold">{formatRupiah(1800000)}</strong> untuk penggantian layar, sisa dana Rp 6.700.000 dicairkan ke dompet penjual.
              </p>
            </div>
          </label>
        </div>

        {/* Tri-Party Mediation Chat Timeline */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-on-surface">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span>Ruang Komunikasi 3 Pihak</span>
            </div>
            <span className="bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded-full text-[10px] font-bold">
              Diawasi Tim Kepatuhan
            </span>
          </div>

          <div className="space-y-3">
            {dispute.messages.map((msg, i) => (
              <div key={i} className="flex gap-2.5 items-start text-xs">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                    msg.role === "ADMIN"
                      ? "bg-primary text-on-primary"
                      : msg.role === "BUYER"
                      ? "bg-surface-container-high text-on-surface"
                      : "bg-secondary text-on-secondary"
                  }`}
                >
                  {msg.role === "ADMIN" ? "ADM" : msg.role === "BUYER" ? "BP" : "DA"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-bold text-on-surface">{msg.author}</span>
                    {msg.role === "ADMIN" && (
                      <span className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.2 rounded font-bold">
                        Staff Resmi
                      </span>
                    )}
                    <span className="text-[10px] text-on-surface-variant ml-auto">
                      {msg.timestamp}
                    </span>
                  </div>
                  <div className="bg-surface-container-low p-2.5 rounded-2xl rounded-tl-xs text-on-surface leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action Dock */}
      <div className="fixed bottom-0 inset-x-0 bg-surface-container-lowest/95 backdrop-blur-xl p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] border-t border-outline-variant/30 z-40">
        <div className="max-w-xl mx-auto space-y-2">
          <button
            onClick={() => setShowReplyModal(true)}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-on-primary rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(15,111,255,0.32)] active:scale-98 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Kirim Bukti &amp; Balas Mediator</span>
          </button>
          <div className="flex items-center justify-center gap-4 text-xs text-on-surface-variant">
            <button
              onClick={() => showToast("Menghubungkan ke Hotline Darurat Escrow 24/7...", "info")}
              className="flex items-center gap-1 hover:text-primary transition-colors py-1 font-semibold"
            >
              <Headphones className="w-3.5 h-3.5 text-secondary" />
              <span>Hotline Darurat Escrow (24/7)</span>
            </button>
            <span>•</span>
            <Link
              href="/help/escrow"
              className="hover:text-primary transition-colors py-1 font-semibold"
            >
              Aturan Garansi Rekber
            </Link>
          </div>
        </div>
      </div>

      {/* Reply Modal */}
      <Modal
        isOpen={showReplyModal}
        onClose={() => setShowReplyModal(false)}
        title="Tulis Tanggapan Mediasi"
      >
        <form onSubmit={handleSendReply} className="space-y-3 text-xs">
          <p className="text-on-surface-variant">
            Pesan kamu akan dibaca oleh mediator resmi dan pihak lawan sengketa. Sertakan data yang faktual dan sopan.
          </p>
          <textarea
            rows={4}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Tulis tanggapan atau konfirmasi solusi mediasi di sini..."
            className="w-full p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowReplyModal(false)}
              className="flex-1 py-2.5 bg-surface-container-high text-on-surface rounded-xl font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/90"
            >
              Kirim Pesan
            </button>
          </div>
        </form>
      </Modal>

      {/* Lightbox / Preview Modal */}
      {activeMediaPreview && (
        <div
          onClick={() => setActiveMediaPreview(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-xl w-full aspect-video rounded-2xl overflow-hidden bg-black">
            <Image
              src={activeMediaPreview}
              alt="Evidence Preview"
              fill
              sizes="(max-width: 640px) 100vw, 576px"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
