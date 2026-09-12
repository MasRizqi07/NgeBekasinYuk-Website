"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, User, Phone, ArrowRight, ShieldCheck } from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";
import { useToast } from "@/components/ui/Toast";

export default function RegisterPage() {
  const router = useRouter();
  const { updateProfile, login } = useUserStore();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    if (!name || !email || !password) {
      setErrorMessage("Harap lengkapi nama, email, dan kata sandi");
      showToast("Harap lengkapi nama, email, dan kata sandi", "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          phone: phone || undefined,
          role: "BUYER",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || "Gagal mendaftarkan akun.";
        setErrorMessage(msg);
        showToast(msg, "error");
        setIsLoading(false);
        return;
      }

      updateProfile({ name, email, phone });
      login(email);
      showToast("Akun berhasil dibuat! Silakan lakukan verifikasi e-KYC", "success");
      router.push("/profile/verification");
    } catch {
      const msg = "Terjadi kendala jaringan saat pendaftaran.";
      setErrorMessage(msg);
      showToast(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-sm space-y-5 text-xs">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-black text-on-surface">Daftar Akun Baru</h1>
        <p className="text-on-surface-variant">
          Mulai jual beli gadget secondhand aman dengan proteksi rekber escrow
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-3">
        <div className="space-y-1">
          <label className="font-bold text-on-surface">Nama Lengkap Sesuai KTP</label>
          <div className="relative flex items-center">
            <User className="w-4 h-4 text-on-surface-variant absolute left-3" />
            <input
              type="text"
              required
              placeholder="Contoh: Budi Pratama"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="font-bold text-on-surface">Alamat Email</label>
          <div className="relative flex items-center">
            <Mail className="w-4 h-4 text-on-surface-variant absolute left-3" />
            <input
              type="email"
              required
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="font-bold text-on-surface">Nomor WhatsApp Aktif</label>
          <div className="relative flex items-center">
            <Phone className="w-4 h-4 text-on-surface-variant absolute left-3" />
            <input
              type="tel"
              placeholder="08123456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="font-bold text-on-surface">Kata Sandi</label>
          <div className="relative flex items-center">
            <Lock className="w-4 h-4 text-on-surface-variant absolute left-3" />
            <input
              type="password"
              required
              placeholder="Minimal 8 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            />
          </div>
        </div>

        <div className="p-2.5 bg-surface-container-low rounded-xl text-[11px] text-on-surface-variant flex items-start gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
          <span>
            Dengan mendaftar, kamu menyetujui Ketentuan Layanan &amp; Kebijakan Rekening Bersama Escrow NgeBekasinYuk.
          </span>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-75"
        >
          <span>{isLoading ? "Memproses..." : "Daftar Sekarang"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="text-center pt-2">
        <span className="text-on-surface-variant">Sudah punya akun? </span>
        <Link href="/login" className="font-bold text-primary hover:underline">
          Masuk di Sini
        </Link>
      </div>
    </div>
  );
}
