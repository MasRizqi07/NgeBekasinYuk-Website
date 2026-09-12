"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight } from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useUserStore();
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || "Email atau kata sandi tidak cocok.";
        setErrorMessage(msg);
        showToast(msg, "error");
        setIsLoading(false);
        return;
      }

      login(data.user?.email || email);
      showToast("Selamat datang kembali di NgeBekasinYuk!", "success");
      router.push("/");
    } catch {
      const msg = "Terjadi kendala jaringan saat masuk.";
      setErrorMessage(msg);
      showToast(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-sm space-y-5 text-xs">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-black text-on-surface">Masuk ke Akun</h1>
        <p className="text-on-surface-variant">
          Jual beli gadget secondhand dengan garansi rekening bersama 100% aman
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {/* Google OAuth Button */}
      <button
        type="button"
        onClick={() => {
          login("budi.pratama@gmail.com");
          showToast("Masuk menggunakan Akun Google", "success");
          router.push("/");
        }}
        className="w-full py-3 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-xl font-bold border border-outline-variant/30 flex items-center justify-center gap-2.5 transition-all shadow-xs"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Lanjutkan dengan Google</span>
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px bg-outline-variant/30 flex-1"></div>
        <span className="text-[11px] text-on-surface-variant font-medium">atau dengan email</span>
        <div className="h-px bg-outline-variant/30 flex-1"></div>
      </div>

      <form onSubmit={handleLogin} className="space-y-3.5">
        <div className="space-y-1">
          <label className="font-bold text-on-surface">Email / No. Handphone</label>
          <div className="relative flex items-center">
            <Mail className="w-4 h-4 text-on-surface-variant absolute left-3" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              required
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="font-bold text-on-surface">Kata Sandi</label>
            <a href="#" className="text-[11px] text-primary hover:underline font-semibold">
              Lupa sandi?
            </a>
          </div>
          <div className="relative flex items-center">
            <Lock className="w-4 h-4 text-on-surface-variant absolute left-3" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-75"
        >
          <span>{isLoading ? "Memproses..." : "Masuk ke Akun"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="text-center pt-2">
        <span className="text-on-surface-variant">Belum punya akun? </span>
        <Link href="/register" className="font-bold text-primary hover:underline">
          Daftar Sekarang
        </Link>
      </div>
    </div>
  );
}
