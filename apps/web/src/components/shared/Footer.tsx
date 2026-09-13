import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock, Award, HeartHandshake } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-white border-t border-surface-border mt-auto hidden sm:block">
      {/* 4 Brand Pillars */}
      <div className="border-b border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary-soft text-brand-primary flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-on-surface">100% Escrow Aman</h4>
              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                Uang ditahan di rekening bersama resmi sampai barang diterima & diuji.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-secondary-light text-brand-secondary flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-on-surface">Inspeksi 2x24 Jam</h4>
              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                Waktu leluasa bagi pembeli untuk menguji fungsi & cek kelayakan unit.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF4E0] text-[#B26A00] flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-on-surface">Penjual Terverifikasi</h4>
              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                Validasi identitas e-KYC KTP mencegah akun bodong dan penipuan.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-danger-soft text-brand-danger flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-on-surface">Pusat Mediasi Sengketa</h4>
              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                Tim admin profesional siap mengawal jika barang tidak sesuai deskripsi.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Links & Copyright */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="md:col-span-2 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-primary text-white flex items-center justify-center font-bold text-xs">
                N
              </div>
              <span className="font-extrabold text-lg tracking-tight text-on-surface">
                NgeBekasin<span className="text-brand-primary">Yuk</span>
              </span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed max-w-sm">
              Platform C2C jual beli gadget, laptop, kamera, dan perangkat teknologi bekas
              terpercaya di Indonesia dengan proteksi pembayaran rekening bersama (Escrow).
            </p>
            <p className="text-[11px] text-text-muted mt-2">
              PT NgeBekasin Nusantara • Kustodian Escrow Terdaftar & Diawasi
            </p>
          </div>

          <div>
            <h4 className="font-bold text-sm text-on-surface mb-3">Kategori Gadget</h4>
            <ul className="space-y-2 text-xs text-text-secondary">
              <li><Link href="/search?category=smartphone" className="hover:text-brand-primary">Smartphone & iPhone</Link></li>
              <li><Link href="/search?category=laptop" className="hover:text-brand-primary">MacBook & Laptop</Link></li>
              <li><Link href="/search?category=camera" className="hover:text-brand-primary">Kamera & Lensa</Link></li>
              <li><Link href="/search?category=pc-gaming" className="hover:text-brand-primary">PC Gaming & GPU</Link></li>
              <li><Link href="/search?category=console" className="hover:text-brand-primary">PlayStation & Switch</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm text-on-surface mb-3">Jual & Beli Aman</h4>
            <ul className="space-y-2 text-xs text-text-secondary">
              <li><Link href="/help/escrow" className="hover:text-brand-primary">Panduan Rekber Escrow</Link></li>
              <li><Link href="/sell" className="hover:text-brand-primary">Cara Pasang Iklan</Link></li>
              <li><Link href="/profile/verification" className="hover:text-brand-primary">Verifikasi e-KYC</Link></li>
              <li><Link href="/wallet" className="hover:text-brand-primary">Pencairan Saldo Dompet</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm text-on-surface mb-3">Bantuan & Operasional</h4>
            <ul className="space-y-2 text-xs text-text-secondary">
              <li><Link href="/help/escrow" className="hover:text-brand-primary">Pusat Bantuan</Link></li>
              <li><Link href="/admin/dashboard" className="hover:text-brand-primary">Admin Backoffice</Link></li>
              <li><span className="text-text-muted">Hubungi CS 24/7 (WhatsApp)</span></li>
              <li><span className="text-text-muted">Syarat & Ketentuan</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-surface-border mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <p>© 2026 NgeBekasinYuk. Hak Cipta Dilindungi Undang-Undang.</p>
          <div className="flex items-center gap-4">
            <Link href="/help/escrow" className="hover:underline">Kebijakan Privasi</Link>
            <Link href="/help/escrow" className="hover:underline">Garansi Retur</Link>
            <Link href="/admin/dashboard" className="text-purple-600 hover:underline">Admin Console</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
