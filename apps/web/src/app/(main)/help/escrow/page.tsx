"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Lock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  ChevronDown,
  XCircle,
  Gavel,
  Building2,
} from "lucide-react";

export default function EscrowEducationPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: "Bagaimana cara kerja rekening escrow rekber di NgeBekasinYuk?",
      a: "Saat kamu membayar pesanan, uangmu tidak langsung masuk ke rekening pribadi penjual, melainkan disimpan dengan aman di rekening kustodian resmi PT NgeBekasin Nusantara. Penjual diwajibkan mengirim barang terlebih dahulu. Setelah barang kamu terima dan diuji selama 2x24 jam dalam kondisi baik, barulah dana dicairkan ke penjual.",
    },
    {
      q: "Berapa lama masa inspeksi pengujian gadget bekas?",
      a: "Kamu memiliki waktu 2x24 jam (48 jam) penuh terhitung sejak kurir mengubah status pengiriman menjadi 'Paket Tiba / Diterima'. Kamu bebas menguji kondisi baterai, layar, IMEI, fungsionalitas hardware, dan software tanpa terburu-buru.",
    },
    {
      q: "Apa yang terjadi jika gadget yang datang bermasalah atau minus tidak sesuai deskripsi?",
      a: "Cukup klik tombol 'Ajukan Komplain' sebelum batas 48 jam berakhir. Dana transaksi otomatis dibekukan aman di escrow. Tim mediasi netral kami akan memverifikasi rekaman video unboxing dan memfasilitasi retur barang dengan jaminan refund dana 100% utuh.",
    },
    {
      q: "Apakah pembeli dikenakan biaya tambahan untuk proteksi escrow?",
      a: "Saat ini seluruh transaksi pembelian gadget di platform NgeBekasinYuk mendapatkan subsidi PROMO GRATIS biaya escrow rekber 100%. Kamu cukup membayar harga barang dan ongkos kirim standar kurir.",
    },
  ];

  return (
    <div className="min-h-screen bg-surface pb-32 pt-4">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        {/* Subheader */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant font-semibold">
            <Link href="/" className="hover:text-primary">
              Beranda
            </Link>
            <span>/</span>
            <span className="text-on-surface">Pusat Edukasi Escrow</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% Rekber Terlindungi</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-bold shadow-xs">
            <Lock className="w-3.5 h-3.5 text-primary" />
            <span>Garansi Perlindungan Pembeli 100%</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-on-surface tracking-tight leading-snug">
            Beli Gadget Bekas Tanpa Waswas. Bukan Janji Manis, Tapi{" "}
            <span className="text-primary">Sistem Escrow</span>.
          </h1>

          <p className="text-xs md:text-sm text-on-surface-variant leading-relaxed">
            Uang kamu tersimpan aman di rekening penampung kustodian resmi kami. Penjual nakal tidak akan pernah menerima uang sepeser pun sebelum kamu puas dan mengonfirmasi kelayakan fisik gadget.
          </p>

          {/* Highlights */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant/30 shadow-xs">
              <Building2 className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="font-bold text-on-surface">Rp 0 Sengketa</div>
              <span className="text-[10px] text-on-surface-variant">Bebas Biaya Klaim</span>
            </div>
            <div className="bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant/30 shadow-xs">
              <Clock className="w-5 h-5 text-secondary mx-auto mb-1" />
              <div className="font-bold text-on-surface">2x24 Jam</div>
              <span className="text-[10px] text-on-surface-variant">Masa Uji Mandiri</span>
            </div>
            <div className="bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant/30 shadow-xs">
              <Gavel className="w-5 h-5 text-amber-700 mx-auto mb-1" />
              <div className="font-bold text-on-surface">Kustodian BI</div>
              <span className="text-[10px] text-on-surface-variant">Regulasi Resmi</span>
            </div>
          </div>

          {/* Hero Media Spotlight */}
          <div className="rounded-2xl overflow-hidden relative aspect-video bg-surface-container border border-outline-variant/30 shadow-xs">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAQeXehsaG4yopCPWnNlKxbXhhVZXP0oGYJ313SJaaC4oVmkpsOXoN2lo4COv0tMeMa9Igim0wvwqSayBUCffKTpLUOqNSZP3xjEvh16JoENiYxdwE0dg2hL-0tpnFcNp77i6pE6mkwE3xQNXxRZzgSG2OJgCOKjx2L21y-7N3AeAqyy3beV65rgVjFWFBVKdLSBws906KVJHtfc5esPtclLw7AyUj-5gaViHClISCTUqpYAzLfjsKq"
              alt="Escrow protection spotlight"
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
              <div className="flex items-center gap-2 text-white text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-secondary-fixed shrink-0" />
                <span>Rekening Escrow Resmi Dipercaya 85.000+ Transaksi Sukses</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Step Infographic */}
        <div className="bg-surface-container-low rounded-3xl p-5 border border-outline-variant/30 space-y-4">
          <div className="space-y-0.5">
            <span className="text-primary font-bold text-xs uppercase tracking-wider">
              3 Langkah Transparan
            </span>
            <h2 className="font-bold text-base md:text-lg text-on-surface">
              Bagaimana Sistem Escrow Melindungi Kamu?
            </h2>
            <p className="text-xs text-on-surface-variant">
              Alur perlindungan otomatis yang menjamin dana tidak raib sebelum unit teruji layak pakai.
            </p>
          </div>

          <div className="space-y-3">
            {/* Step 1 */}
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-bold text-[10px]">
                  Langkah 01
                </span>
                <span className="text-on-surface-variant text-[11px]">Detik Pertama</span>
              </div>
              <h3 className="font-bold text-sm text-on-surface">Kamu Bayar &amp; Dana Terkunci 🔐</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Uang bukan ditransfer ke rekening pribadi seller, melainkan dienkripsi di rekening penampung resmi. Penjual menerima notifikasi untuk segera mengirim barang.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold text-[10px]">
                  Langkah 02
                </span>
                <span className="text-secondary font-bold text-[11px]">2x24 Jam Penuh</span>
              </div>
              <h3 className="font-bold text-sm text-on-surface">
                Penjual Kirim &amp; Masa Inspeksi Mandiri 📦
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Unit dikirim dengan resi terlacak. Timer 2x24 jam baru mulai dihitung sejak kurir mengonfirmasi paket telah sampai di tanganmu. Uji baterai, layar, IMEI, dan fitur hardware.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 font-bold text-[10px]">
                  Langkah 03
                </span>
                <span className="text-amber-700 font-bold text-[11px]">Uang Cair / Refund</span>
              </div>
              <h3 className="font-bold text-sm text-on-surface">
                Konfirmasi OK atau 100% Refund ⚖️
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Puas? Klik lepas dana untuk mencairkan saldo ke penjual. Jika ada kendala yang tidak sesuai deskripsi, klik Ajukan Komplain untuk refund 100%.
              </p>
            </div>
          </div>
        </div>

        {/* Comparison: Direct Transfer vs Escrow */}
        <div className="space-y-3">
          <div>
            <span className="text-error font-bold text-xs uppercase tracking-wider">
              Perbandingan Nyata
            </span>
            <h2 className="font-bold text-base md:text-lg text-on-surface">
              Transfer Langsung vs Escrow Bersama
            </h2>
            <p className="text-xs text-on-surface-variant">
              Mengapa 98% kasus penipuan online terjadi akibat transaksi langsung ke rekening pribadi penjual.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            {/* Comp 1 */}
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs space-y-2.5">
              <div className="font-bold text-on-surface">
                1. Risiko Uang Melayang / Penjual Kabur
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center gap-1 text-red-700 font-bold text-[11px]">
                    <XCircle className="w-3.5 h-3.5" /> Transfer Langsung
                  </div>
                  <p className="text-on-surface-variant text-[11px]">
                    Sangat tinggi! Uang ditransfer lalu nomor WA langsung diblokir.
                  </p>
                </div>
                <div className="bg-secondary/10 border border-secondary/20 p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center gap-1 text-secondary font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Escrow Kami
                  </div>
                  <p className="text-on-surface-variant text-[11px]">
                    0% Risiko! Seller baru terima uang setelah kamu konfirmasi fisik.
                  </p>
                </div>
              </div>
            </div>

            {/* Comp 2 */}
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs space-y-2.5">
              <div className="font-bold text-on-surface">2. Waktu Cek &amp; Uji Hardware Unit</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center gap-1 text-red-700 font-bold text-[11px]">
                    <XCircle className="w-3.5 h-3.5" /> Transfer Langsung
                  </div>
                  <p className="text-on-surface-variant text-[11px]">
                    Nol besar. Ada cacat baterai bocor atau LCD garis ditanggung sendiri.
                  </p>
                </div>
                <div className="bg-secondary/10 border border-secondary/20 p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center gap-1 text-secondary font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Escrow Kami
                  </div>
                  <p className="text-on-surface-variant text-[11px]">
                    Garansi 2x24 Jam resmi terlindungi oleh sistem.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Anti-Fraud Notice */}
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs space-y-2">
          <div className="flex items-center gap-2 text-red-700 font-bold">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-sm">PERINGATAN KERAS ANTI-PENIPUAN</h3>
          </div>
          <p className="text-on-surface-variant leading-relaxed">
            Dilarang keras bertransaksi atau transfer langsung di luar sistem NgeBekasinYuk! Tim kami{" "}
            <strong className="text-red-700 underline">TIDAK DAPAT melindungi uangmu</strong> jika terjadi transaksi lewat rekening pribadi penjual. Tolak ajakan &ldquo;DP duluan via WA&rdquo;.
          </p>
          <div className="space-y-1 pt-1 text-[11px] font-semibold text-red-800">
            <div>• Jangan transfer DP ke rekening bank pribadi seller</div>
            <div>• Jangan pindah jalur chat ke WhatsApp sebelum transaksi selesai</div>
            <div>• Tolak pengiriman yang tidak menggunakan resi kurir terdaftar</div>
          </div>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-3">
          <h2 className="font-bold text-base text-on-surface">Pertanyaan Seputar Escrow (FAQ)</h2>
          <div className="space-y-2 text-xs">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden shadow-xs"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-4 text-left font-bold text-on-surface flex items-center justify-between gap-3"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-on-surface-variant shrink-0 transition-transform ${
                      openFaq === idx ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-4 text-on-surface-variant leading-relaxed pt-0 border-t border-outline-variant/10">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center pt-2">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-md hover:bg-primary/90 transition-all"
          >
            <Search className="w-4 h-4" />
            <span>Jelajahi Gadget Bekas Terlindungi Escrow</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
