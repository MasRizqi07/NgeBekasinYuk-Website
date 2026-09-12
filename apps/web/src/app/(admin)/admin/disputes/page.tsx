"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Gavel,
  CheckCircle2,
  AlertTriangle,
  Play,
  Lock,
  RotateCw,
  Building2,
  Truck,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { useDisputeStore } from "@/stores/useDisputeStore";
import { formatRupiah } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import confetti from "canvas-confetti";

export default function AdminDisputesPage() {
  const { disputes, resolveDispute } = useDisputeStore();
  const { showToast } = useToast();

  const [selectedDisputeId, setSelectedDisputeId] = useState(
    disputes[0]?.id || "DSP-2026-88421"
  );
  const [verdictOption, setVerdictOption] = useState<
    "REFUND_BUYER" | "RELEASE_SELLER" | "PARTIAL"
  >("REFUND_BUYER");
  const [adminNotes, setAdminNotes] = useState(
    "Berdasarkan investigasi menyeluruh tim Risk & Ops, video unboxing pembeli valid tanpa jeda. Sesuai Klausul Perlindungan Rekber Bab IV Pasal 8, permohonan retur-refund disetujui penuh."
  );
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);

  const activeDispute =
    disputes.find((d) => d.id === selectedDisputeId) || disputes[0];

  const handleExecuteVerdict = async () => {
    setIsExecuting(true);
    const finalVerdict =
      verdictOption === "PARTIAL" ? "REFUND_BUYER" : verdictOption;

    try {
      // Stage 1: Request scoped one-time step-up grant token from /api/admin/step-up (AP4-P0-04)
      const stepUpRes = await fetch("/api/admin/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: totpCode,
          action: "DISPUTE_VERDICT",
          resourceId: activeDispute.id,
        }),
      });

      if (!stepUpRes.ok) {
        const stepUpData = await stepUpRes.json().catch(() => ({}));
        showToast(stepUpData.message || "Verifikasi 2FA TOTP gagal. Pastikan kode 6 digit benar.", "error");
        setIsExecuting(false);
        return;
      }

      const { grantToken } = await stepUpRes.json();

      // Stage 2: Authoritatively execute verdict using the single-use scoped grant token
      const res = await fetch(`/api/disputes/${activeDispute.id}/verdict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict: finalVerdict,
          adminNotes,
          stepUpCode: grantToken,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || "Gagal memproses putusan sengketa.", "error");
        setIsExecuting(false);
        return;
      }

      resolveDispute(activeDispute.id, finalVerdict, adminNotes);
      setIsExecuting(false);
      setShow2FAModal(false);
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });
      showToast(
        `Putusan resmi untuk sengketa #${activeDispute.id} berhasil dieksekusi dan tercatat di NgeBekasinYuk Internal Audit Log.`,
        "success"
      );
    } catch {
      showToast("Terjadi kesalahan jaringan saat memproses putusan sengketa.", "error");
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 text-xs">
      {/* Top KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* GMV */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
            <span className="uppercase tracking-wider font-semibold">Total GMV Bulan Ini</span>
            <span className="p-1.5 rounded-lg bg-secondary-fixed text-on-secondary-fixed">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-on-surface">Rp 3.842.500.000</div>
          <div className="flex items-center gap-1 text-[11px] text-secondary font-bold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+18.4% MoM (Oktober 2026)</span>
          </div>
        </div>

        {/* Escrow Held */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
            <span className="uppercase tracking-wider font-semibold">Transaksi Escrow Aktif</span>
            <span className="p-1.5 rounded-lg bg-primary-fixed text-primary">
              <Lock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-on-surface">428 Transaksi</div>
          <div className="text-[11px] text-primary font-bold">
            Rp 1.240.800.000 saldo kustodian
          </div>
        </div>

        {/* Disputes */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
            <span className="uppercase tracking-wider font-semibold">Tiket Dispute Terbuka</span>
            <span className="p-1.5 rounded-lg bg-red-500/10 text-red-600">
              <Gavel className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-on-surface flex items-center gap-2">
            <span>14 Kasus</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 font-bold">
              5 High-Risk
            </span>
          </div>
          <div className="text-[11px] text-red-700 font-semibold">SLA Terdekat: &lt; 4 Jam</div>
        </div>

        {/* SLA Rate */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
            <span className="uppercase tracking-wider font-semibold">Tingkat Resolusi SLA</span>
            <span className="p-1.5 rounded-lg bg-secondary-fixed text-on-secondary-fixed">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-secondary">99.4%</div>
          <div className="text-[11px] text-on-surface-variant">Rata-rata investigasi 18 Jam</div>
        </div>
      </div>

      {/* Main Workspace Layout (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Queue List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-on-surface">Antrean Mediasi Aktif</h2>
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {disputes.length} Tiket
            </span>
          </div>

          <div className="space-y-2.5">
            {disputes.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelectedDisputeId(d.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                  selectedDisputeId === d.id
                    ? "bg-surface-container-lowest border-primary shadow-sm ring-2 ring-primary/20"
                    : "bg-surface-container-lowest border-outline-variant/30 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono font-bold text-primary">{d.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      d.status.startsWith("RESOLVED")
                        ? "bg-secondary-fixed text-on-secondary-fixed"
                        : "bg-amber-500/10 text-amber-700"
                    }`}
                  >
                    {d.status}
                  </span>
                </div>
                <h3 className="font-bold text-xs text-on-surface truncate">{d.listingTitle}</h3>
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant/20">
                  <span>
                    {d.buyerName} vs {d.sellerName}
                  </span>
                  <span className="font-bold text-on-surface">{formatRupiah(d.listingPrice)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Mediation Workspace */}
        <div className="lg:col-span-8 space-y-4">
          {/* Header Strip */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-black text-on-surface">
                    Sengketa #{activeDispute.id}
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-700">
                    PRIORITAS TINGGI
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-fixed text-on-secondary-fixed">
                    ESCROW HELD
                  </span>
                </div>
                <p className="text-on-surface-variant mt-1">
                  Pesanan: <span className="font-bold text-on-surface">{activeDispute.orderId}</span>{" "}
                  • Komplain Diajukan oleh {activeDispute.buyerName}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-semibold text-on-surface-variant block">
                  Dana Escrow Terkunci
                </span>
                <span className="text-lg font-black text-primary">
                  {formatRupiah(activeDispute.listingPrice)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-outline-variant/20">
              <div className="p-3 bg-surface-container-low rounded-xl flex items-start gap-2.5">
                <Building2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[11px] uppercase text-on-surface-variant block">
                    Payment &amp; Escrow Lock
                  </span>
                  <p className="font-semibold text-on-surface mt-0.5">MIDTRANS-CHARG-998214-ID</p>
                  <p className="text-[11px] text-on-surface-variant">
                    Kustodian BCA PT NgeBekasin Nusantara (OJK Monitored)
                  </p>
                </div>
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl flex items-start gap-2.5">
                <Truck className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[11px] uppercase text-on-surface-variant block">
                    Logistik Terpadu
                  </span>
                  <p className="font-semibold text-on-surface mt-0.5">
                    J&amp;T Express • Resi: JT9928174620
                  </p>
                  <p className="text-[11px] text-secondary font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> DELIVERED (26 Okt 11:28 WIB)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Comparative Evidence Inspection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Buyer Evidence */}
            <div className="bg-surface-container-lowest p-4 rounded-2xl border-t-4 border-t-primary border border-outline-variant/30 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 font-bold text-primary flex items-center justify-center text-xs">
                    BP
                  </div>
                  <div>
                    <span className="font-bold text-on-surface block">
                      {activeDispute.buyerName}
                    </span>
                    <span className="text-[10px] text-on-surface-variant">Pembeli (Penggugat)</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-bold">
                  Trust: 98/100
                </span>
              </div>

              {/* Video Player Preview */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center">
                <Image
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBRTbFAOv8W_XbBkuklHWrt6clzjiyXf5Jt_WWzjJ4HmwL8_nptcJqQmcjAdS-QYUE1LqpYCaB-Vzz2MfF2vom66TKpqlXzKrhEJaoETa-9M0vp7IWxRIamaZazLGTjnpgGxsV6ubT9AGGEc2hylFbOXkv4fcfwU3KL1BpJkkoKcXEgO5JvPCtQMbyqmi1WWYNHChBoODldZ_Yy9GO5MxtD2kFwOAicSe8wCvD2jYHFariTHu-Pb_wU"
                  alt="Buyer video"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover opacity-70"
                />
                <div className="relative z-10 text-center text-white space-y-1">
                  <button className="w-10 h-10 rounded-full bg-primary flex items-center justify-center mx-auto shadow-md">
                    <Play className="w-5 h-5 ml-0.5" />
                  </button>
                  <div className="text-[10px] font-bold">Unboxing_MacBook_Full360.mp4</div>
                  <span className="text-[9px] bg-black/60 px-2 py-0.5 rounded-full inline-block">
                    Durasi 03:42 • Timestamp 01:15
                  </span>
                </div>
              </div>

              <div className="bg-surface-container-low p-3 rounded-xl space-y-1 text-[11px]">
                <span className="font-bold text-on-surface uppercase">Keterangan Penggugat:</span>
                <p className="text-on-surface-variant leading-relaxed">
                  &ldquo;{activeDispute.description}&rdquo;
                </p>
              </div>
            </div>

            {/* Seller Evidence */}
            <div className="bg-surface-container-lowest p-4 rounded-2xl border-t-4 border-t-secondary border border-outline-variant/30 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-secondary-fixed font-bold text-on-secondary-fixed flex items-center justify-center text-xs">
                    DA
                  </div>
                  <div>
                    <span className="font-bold text-on-surface block">
                      {activeDispute.sellerName}
                    </span>
                    <span className="text-[10px] text-on-surface-variant">Penjual (Tergugat)</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold">
                  e-KYC Verified
                </span>
              </div>

              {/* Video Player Preview */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center">
                <Image
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDIbKRY9k0o7HlfY1KlOVSNR2UoEF-RSJJeiHq5BapAAPr7nrC5IfQqax1kLZS82NttiqQAePg2SoIE1uc7W2A8QHrsMz2fybNa9zcgfBuXNEYvruERGWNks_kr1J2VwOcqi_eKoqRcsPhKNs8pc1BqqEZjhNxHHSidaoJp-jYLh7BdwtuXv21wiGE9HtcCl-MLY949ETssQCtfDEr0rOuMZz5Z3gsufK8iUpvrQXcvs-iA7_8D4nPS"
                  alt="Seller video"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover opacity-70"
                />
                <div className="relative z-10 text-center text-white space-y-1">
                  <button className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mx-auto shadow-md">
                    <Play className="w-5 h-5 ml-0.5" />
                  </button>
                  <div className="text-[10px] font-bold">QC_Test_Layar_Sebelum_Kemas.mp4</div>
                  <span className="text-[9px] bg-black/60 px-2 py-0.5 rounded-full inline-block">
                    Durasi 02:15 • 24 Okt 09:40 WIB
                  </span>
                </div>
              </div>

              <div className="bg-surface-container-low p-3 rounded-xl space-y-1 text-[11px]">
                <span className="font-bold text-on-surface uppercase">Keterangan Tergugat:</span>
                <p className="text-on-surface-variant leading-relaxed">
                  &ldquo;Unit 100% normal saat pengetesan dan packing di drop point J&amp;T. Ada kemungkinan benturan handling saat sortir ekspedisi.&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Verdict Decision Panel */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border-2 border-primary/30 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-on-surface">
                  Putusan Sengketa Resmi &amp; Eksekusi Escrow
                </h3>
                <p className="text-[11px] text-on-surface-variant">
                  Pilih tindakan akhir sengketa. Keputusan tercatat pada audit log perbankan.
                </p>
              </div>
              <Gavel className="w-5 h-5 text-primary" />
            </div>

            {/* Radio Options */}
            <div className="space-y-2">
              <label
                onClick={() => setVerdictOption("REFUND_BUYER")}
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                  verdictOption === "REFUND_BUYER"
                    ? "bg-red-500/5 border-red-500/40"
                    : "bg-surface-container-low border-transparent hover:bg-surface-container"
                }`}
              >
                <input
                  type="radio"
                  name="verdict"
                  checked={verdictOption === "REFUND_BUYER"}
                  onChange={() => setVerdictOption("REFUND_BUYER")}
                  className="mt-1 accent-red-600 w-4 h-4"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-700">
                      [Putuskan untuk Pembeli / FULL REFUND]
                    </span>
                    <span className="px-2 py-0.2 rounded bg-red-500/10 text-red-700 font-bold text-[10px]">
                      {formatRupiah(activeDispute.listingPrice)} ke Pembeli
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Dana escrow dikembalikan 100% ke saldo pembeli. Penjual diwajibkan menerima retur unit atau dikenai penalti trust score.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setVerdictOption("RELEASE_SELLER")}
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                  verdictOption === "RELEASE_SELLER"
                    ? "bg-secondary/5 border-secondary/40"
                    : "bg-surface-container-low border-transparent hover:bg-surface-container"
                }`}
              >
                <input
                  type="radio"
                  name="verdict"
                  checked={verdictOption === "RELEASE_SELLER"}
                  onChange={() => setVerdictOption("RELEASE_SELLER")}
                  className="mt-1 accent-secondary w-4 h-4"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-secondary">
                      [Putuskan untuk Penjual / RELEASE ESCROW]
                    </span>
                    <span className="px-2 py-0.2 rounded bg-secondary-fixed text-on-secondary-fixed font-bold text-[10px]">
                      {formatRupiah(activeDispute.listingPrice)} ke Seller
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Lepas dana ke saldo dompet penjual. Komplain ditolak dengan dasar video packing lengkap.
                  </p>
                </div>
              </label>
            </div>

            {/* Consideration Notes */}
            <div className="space-y-1">
              <label className="font-bold text-on-surface">Catatan Pertimbangan Resmi *</label>
              <textarea
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              type="button"
              onClick={() => setShow2FAModal(true)}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Eksekusi Putusan &amp; Buka Otorisasi 2FA 🔒</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2FA Confirmation Modal */}
      <Modal
        isOpen={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        title="Otorisasi 2FA Super Admin"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="block">Tindakan Irreversible:</strong>
              <span>
                Anda akan mengeksekusi pelepasan dana sebesar{" "}
                <strong>{formatRupiah(activeDispute.listingPrice)}</strong> sesuai opsi{" "}
                <strong>{verdictOption}</strong>.
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-bold text-on-surface block text-center">
              Masukkan 6-Digit Kode Authenticator Admin:
            </label>
            <div className="flex justify-center font-mono">
              <input
                type="text"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit TOTP"
                className="w-44 h-12 text-center text-xl tracking-widest font-bold rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <p className="text-[10px] text-center text-on-surface-variant">
              Otorisasi sesi Super Admin: Sarah Lestari (ADM-99021)
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShow2FAModal(false)}
              className="flex-1 py-2.5 bg-surface-container-high text-on-surface rounded-xl font-bold"
            >
              Batalkan
            </button>
            <button
              type="button"
              disabled={isExecuting}
              onClick={handleExecuteVerdict}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isExecuting ? "animate-spin" : ""}`} />
              <span>{isExecuting ? "Mengeksekusi..." : "Otorisasi & Lepaskan"}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
