import React from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between p-4">
      <div className="flex justify-center pt-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary font-black shadow-sm">
            N
          </div>
          <span className="font-black text-lg tracking-tight text-on-surface">
            NgeBekasin<span className="text-primary">Yuk</span>
          </span>
        </Link>
      </div>

      <div className="max-w-md w-full mx-auto my-auto">{children}</div>

      <div className="text-center text-xs text-on-surface-variant pb-4">
        &copy; 2026 PT NgeBekasin Nusantara • Kustodian Escrow Terdaftar OJK &amp; BI
      </div>
    </div>
  );
}
