"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Camera,
  RotateCcw,
  Sparkles,
  Zap,
  Star,
  Store,
  Wallet,
  Eye,
  EyeOff,
  Check,
  Scan,
  TrendingUp,
} from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";
import { useToast } from "@/components/ui/Toast";
import confetti from "canvas-confetti";

export default function VerificationKYCPage() {
  const router = useRouter();
  const { user, submitKYC } = useUserStore();
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState<number>(2); // Step 2: Foto KTP
  const [nikVisible, setNikVisible] = useState(false);
  const [nik, setNik] = useState("3175062408980002");
  const [fullName, setFullName] = useState(user?.name || "Achmad Rizqi Mubarok");
  const [birthDate, setBirthDate] = useState("24 Agustus 1998");
  const [address, setAddress] = useState(
    "Jl. Mawar Asri No. 18, RT 04/RW 02, Pondok Kelapa, Duren Sawit, Jakarta Timur"
  );
  const [hasCapturedKTP, setHasCapturedKTP] = useState(false);
  const [hasCapturedSelfie, setHasCapturedSelfie] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCaptureKTP = () => {
    setHasCapturedKTP(true);
    showToast("Foto e-KTP berhasil diambil dan diproses AI OCR", "success");
    setCurrentStep(3);
  };

  const handleCaptureSelfie = () => {
    setHasCapturedSelfie(true);
    showToast("Deteksi wajah biometrik liveness berhasil", "success");
    setCurrentStep(4);
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      submitKYC(
        nik,
        "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80"
      );
      setIsSubmitting(false);
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });
      showToast("Selamat! Akunmu kini Berstatus Terverifikasi Resmi 🎉", "success");
      setTimeout(() => {
        router.push("/profile");
      }, 1200);
    }, 1500);
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
            <h1 className="font-bold text-headline-sm text-on-surface">Verifikasi Akun e-KYC</h1>
            <div className="flex items-center gap-1 text-secondary font-bold text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Standar Keamanan Rekber</span>
            </div>
          </div>
          <div className="w-10"></div>
        </div>

        {/* Security Assurance Banner */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="font-bold text-xs text-on-surface">Verifikasi Identitas Resmi</span>
            </div>
            <span className="bg-secondary/10 text-secondary px-2.5 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1">
              <Lock className="w-3 h-3" /> AES-256 SSL
            </span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Wajib verifikasi e-KYC 1x seumur hidup untuk menjadi Penjual terpercaya, membuka batas penarikan saldo escrow, dan mengaktifkan garansi rekening bersama.
          </p>
        </div>

        {/* 4-Step Progress Indicator */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-6 right-6 top-4 h-0.5 bg-surface-container-highest -z-0"></div>
            <div
              className="absolute left-6 top-4 h-0.5 bg-secondary -z-0 transition-all duration-300"
              style={{
                width:
                  currentStep === 1
                    ? "0%"
                    : currentStep === 2
                    ? "33%"
                    : currentStep === 3
                    ? "66%"
                    : "100%",
              }}
            ></div>

            {/* Step 1 */}
            <div className="flex flex-col items-center gap-1 z-10">
              <div className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-xs font-bold shadow-xs">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-secondary">1. NIK KTP</span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center gap-1 z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-xs ${
                  currentStep >= 2
                    ? hasCapturedKTP
                      ? "bg-secondary text-on-secondary"
                      : "bg-primary text-on-primary ring-4 ring-primary/20"
                    : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {hasCapturedKTP ? <Check className="w-4 h-4" /> : "2"}
              </div>
              <span
                className={`text-[10px] font-bold ${
                  currentStep === 2 ? "text-primary" : "text-on-surface-variant"
                }`}
              >
                2. Foto KTP
              </span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center gap-1 z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-xs ${
                  currentStep >= 3
                    ? hasCapturedSelfie
                      ? "bg-secondary text-on-secondary"
                      : "bg-primary text-on-primary ring-4 ring-primary/20"
                    : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {hasCapturedSelfie ? <Check className="w-4 h-4" /> : "3"}
              </div>
              <span
                className={`text-[10px] font-bold ${
                  currentStep === 3 ? "text-primary" : "text-on-surface-variant"
                }`}
              >
                3. Selfie
              </span>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center gap-1 z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-xs ${
                  currentStep === 4
                    ? "bg-primary text-on-primary ring-4 ring-primary/20"
                    : "bg-surface-container text-on-surface-variant"
                }`}
              >
                4
              </div>
              <span
                className={`text-[10px] font-bold ${
                  currentStep === 4 ? "text-primary" : "text-on-surface-variant"
                }`}
              >
                4. Tinjau
              </span>
            </div>
          </div>
        </div>

        {/* Viewfinder Section: Step 2 (Foto KTP) */}
        {currentStep === 2 && (
          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs text-on-surface">Pindai e-KTP Fisik Asli</h3>
                <p className="text-[11px] text-on-surface-variant">
                  Posisikan KTP pas di dalam bingkai pemindai
                </p>
              </div>
              <button
                onClick={() => setIsFlashOn(!isFlashOn)}
                className={`p-2 rounded-full transition-colors ${
                  isFlashOn
                    ? "bg-amber-500/20 text-amber-700"
                    : "bg-surface-container text-on-surface-variant"
                }`}
              >
                <Zap className="w-4 h-4" />
              </button>
            </div>

            {/* Camera Viewfinder */}
            <div className="relative w-full aspect-[16/10] bg-zinc-900 rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-90 animate-pulse top-1/3"></div>

              {/* Corner Reticle Guides */}
              <div className="absolute inset-4 pointer-events-none flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg"></div>
                  <div className="w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg"></div>
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg"></div>
                  <div className="w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg"></div>
                </div>
              </div>

              {/* KTP Silhouette Mock */}
              <div className="w-[84%] h-[84%] bg-white/10 rounded-lg p-3 flex flex-col justify-between backdrop-blur-xs border border-white/20">
                <div className="flex items-center justify-between">
                  <div className="h-2 w-20 bg-white/40 rounded"></div>
                  <div className="h-2 w-12 bg-white/40 rounded"></div>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 space-y-1.5">
                    <div className="w-6 h-4 bg-amber-400/40 rounded-xs"></div>
                    <div className="h-2 w-3/4 bg-white/40 rounded"></div>
                    <div className="h-2 w-1/2 bg-white/40 rounded"></div>
                  </div>
                  <div className="w-14 h-16 bg-white/20 rounded flex items-center justify-center">
                    <Scan className="w-6 h-6 text-white/50" />
                  </div>
                </div>
                <div className="bg-black/60 rounded px-2 py-0.5 self-center flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed animate-ping"></span>
                  <span className="text-[10px] text-white font-medium">Sensor AI Siap Memindai</span>
                </div>
              </div>
            </div>

            {/* Quality Badges */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-secondary/10 px-2.5 py-1.5 rounded-xl text-secondary">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Posisi Pas Presisi</span>
              </div>
              <div className="flex items-center gap-1.5 bg-secondary/10 px-2.5 py-1.5 rounded-xl text-secondary">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">NIK &amp; Teks Terbaca</span>
              </div>
            </div>

            {/* Shutter Button */}
            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                onClick={handleCaptureKTP}
                className="w-14 h-14 rounded-full bg-surface-container-lowest p-1 shadow-md flex items-center justify-center border-2 border-primary active:scale-95 transition-transform"
              >
                <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-on-primary">
                  <Camera className="w-5 h-5" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Viewfinder Section: Step 3 (Selfie + KTP) */}
        {currentStep === 3 && (
          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs text-on-surface">Selfie dengan Memegang KTP</h3>
                <p className="text-[11px] text-on-surface-variant">
                  Wajah &amp; KTP harus tampak jelas tanpa masker atau kacamata hitam
                </p>
              </div>
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold text-[10px]">
                Liveness 3 Detik
              </span>
            </div>

            <div className="relative w-full aspect-[4/3] bg-zinc-900 rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
              {/* Oval Face Guide */}
              <div className="w-40 h-52 rounded-full border-2 border-dashed border-primary flex items-center justify-center relative">
                <div className="w-16 h-12 rounded bg-amber-400/30 border border-amber-300 absolute -bottom-2 -right-4 flex items-center justify-center">
                  <span className="text-[9px] text-white font-bold">KTP</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                onClick={handleCaptureSelfie}
                className="w-14 h-14 rounded-full bg-surface-container-lowest p-1 shadow-md flex items-center justify-center border-2 border-primary active:scale-95 transition-transform"
              >
                <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-on-primary">
                  <Camera className="w-5 h-5" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* OCR Confirmation Form: Step 4 */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs text-on-surface">Konfirmasi Data e-KTP</h3>
              <p className="text-[11px] text-on-surface-variant">
                Periksa kesesuaian hasil pembacaan OCR otomatis
              </p>
            </div>
            <span className="bg-secondary/10 text-secondary px-2.5 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> OCR 99% Akurat
            </span>
          </div>

          <form onSubmit={handleFinalSubmit} className="space-y-3 text-xs">
            {/* Field NIK */}
            <div className="space-y-1">
              <label className="font-bold text-on-surface">Nomor Induk Kependudukan (NIK)</label>
              <div className="relative flex items-center">
                <input
                  type={nikVisible ? "text" : "password"}
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  className="w-full h-10 px-3 pr-10 rounded-xl bg-surface-container-low font-mono text-on-surface font-semibold focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
                />
                <button
                  type="button"
                  onClick={() => setNikVisible(!nikVisible)}
                  className="absolute right-3 text-on-surface-variant hover:text-on-surface"
                >
                  {nikVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Field Nama */}
            <div className="space-y-1">
              <label className="font-bold text-on-surface">Nama Lengkap Sesuai KTP</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Field Tanggal Lahir */}
            <div className="space-y-1">
              <label className="font-bold text-on-surface">Tanggal Lahir</label>
              <input
                type="text"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Field Alamat */}
            <div className="space-y-1">
              <label className="font-bold text-on-surface">Alamat Lengkap Sesuai KTP</label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? "Menyimpan & Memvalidasi Dukcapil..."
                  : "Kirim Verifikasi e-KYC Sekarang"}
              </span>
            </button>
          </form>
        </div>

        {/* Benefits Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-xs text-on-surface">Keuntungan Akun Terverifikasi</h3>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low">
              <div className="w-8 h-8 rounded-full bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-on-surface block">Badge Terverifikasi Resmi</span>
                <span className="text-[11px] text-on-surface-variant">
                  Centang biru-hijau muncul di setiap listing gadget &amp; profil.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low">
              <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-on-surface block">+20 Poin Trust Score Penjual</span>
                <span className="text-[11px] text-on-surface-variant">
                  Iklan gadget diprioritaskan di hasil pencarian teratas pembeli.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low">
              <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-on-surface block">Buka Hak Jual Tanpa Batas</span>
                <span className="text-[11px] text-on-surface-variant">
                  Bebas listing puluhan gadget bekas dengan garansi escrow otomatis.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
