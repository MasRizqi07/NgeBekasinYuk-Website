# Design (UX) — NgeBekasinYuk

> Dokumen ini mendefinisikan pengalaman pengguna NgeBekasinYuk: user flow, halaman, interaksi kunci, dan state-state penting. Fokus: **UI/UX gaya Indonesia yang familiar** (mirip marketplace lokal: Tokopedia/Carousell-style), cepat diakses di mobile, dan menonjolkan **rasa aman** (escrow, badge, trust score).

---

## 1. Prinsip UX

1. **Aman dulu, baru murah** — elemen trust (badge, escrow, trust score) selalu terlihat di titik keputusan user (detail listing, checkout).
2. **Mobile-first** — 80%+ traffic Indonesia di mobile; bottom nav, thumb-friendly, lazy-load gambar.
3. **Jual itu gampang** — flow buat listing ≤ 3 menit, foto langsung dari kamera HP.
4. **Nego itu budaya** — fitur tawar harga satu klik, tanpa perlu chat dulu (opsional).
5. **State yang jelas** — status pesanan selalu bisa dilacak buyer & seller dengan bahasa manusia, bukan istilah teknis.

---

## 2. Persona & Use Case Utama

| Persona | Kebutuhan utama |
|---|---|
| **Budi (Pembeli, 22 th, anak kuliahan)** | Cari laptop second murah, takut ketipu, butuh garansi aman |
| **Sari (Penjual, 28 th, upgrade tiap tahun)** | Mau jual cepat HP lama, males ribet, harga bisa nego |
| **Admin NgeBekasinYuk** | Moderasi konten, mediasi dispute, pantau kesehatan platform |

### Use case kritis (wajib lancas)
1. Register → verifikasi → buat listing dengan foto
2. Cari → filter → buka detail listing → chat/nego → checkout via escrow → bayar
3. Terima resi → lacak paket → konfirmasi terima → beri review
4. Buka dispute dengan bukti → admin mediasi → refund/cair
5. Withdraw saldo ke rekening

---

## 3. Sitemap & Struktur Halaman

```
/ (Home)
├── /p/[kategori-slug]          — listing per kategori
├── /search?q=                  — hasil pencarian + filter
├── /product/[slug]             — detail listing
├── /auth/login, /auth/register, /auth/verify-otp
├── /sell                       — buat listing (multi-step)
├── /sell/edit/[id]
├── /my-listings
├── /cart
├── /checkout
├── /payment/[orderId]/pending  — menunggu pembayaran
├── /orders                     — "Pesanan Saya" (tab: Semua/Berjalan/Selesai/Dibatalkan)
├── /orders/[id]                — detail pesanan + tracking timeline
├── /sales                      — "Penjualan Saya"
├── /chat, /chat/[conversationId]
├── /profile, /profile/addresses, /profile/verification
├── /wallet                     — saldo & withdraw
├── /notifications
├── /disputes/[id]              — halaman dispute (buyer/seller)
└── /help, /help/escrow         — edukasi "Kenapa escrow aman"

Admin (/admin):
├── /admin/dashboard
├── /admin/users
├── /admin/listings (moderasi)
├── /admin/disputes
└── /admin/cms (kategori, banner)
```

---

## 4. User Flow Utama

### 4.1 Onboarding & Verifikasi
```
Buka app → Login/Register (email/Google)
  → Verifikasi OTP (HP) opsional untuk unlock nego + chat
  → (Nanti) e-KYC untuk badge ✅ + withdraw saldo
```
**Catatan**: browse & beli boleh tanpa KYC; **jual & withdraw wajib verifikasi** (peraturan escrow + anti fraud).

### 4.2 Jual Barang (Create Listing) — target ≤ 3 menit
```
Home → tombol "Jual" (CTA floating, warna brand)
  Step 1: Foto (kamera/galeri, min 1 max 10) → auto-kompresi → thumbnail preview → drag reorder
  Step 2: Detail:
    - Kategori (chips: HP, Laptop, Audio, Console, dll.)
    - Merek & model (autocomplete dari katalog → auto-isi spesifikasi dasar)
    - Kondisi (card pilihan: Seperti Baru / Pemakaian Wajar / Lecet / Rusak Ringan)
      → tiap kondisi menampilkan deskripsi bawaan yang bisa diedit (wajib jujur)
    - Harga (input cepat + toggle "Bisa Nego")
    - Kelengkapan (checkbox: dus, charger, kabel, nota)
    - Lokasi (pilih kota)
  Step 3: Preview → Publish / Simpan Draft
```
**Empty state & validasi**: inline error Bahasa Indonesia santai ("Hmm, harganya belum diisi nih"). Auto-save draft tiap 30 detik.

### 4.3 Beli Barang (Discovery → Checkout)
```
Home/Browse → Search bar besar + kategori chips
  → Filter sheet (bottom sheet di mobile): harga slider, kondisi, lokasi, "Verified seller only", "Bisa Nego"
  → Klik listing → Detail produk:
      • Foto carousel + thumbnail
      • Harga besar + badge "Bisa Nego"
      • Card penjual: avatar, nama, ✅ Terverifikasi?, trust score, "Bergabung sejak..."
      • Card kondisi & kelengkapan
      • Tombol: [Chat] [Tawar Harga] [Beli Sekarang / + Keranjang]
  → Beli Sekarang → Checkout:
      • Alamat (pilih/tambah)
      • Kurir (pilih layanan + ongkir realtime)
      • Rincian: Harga barang + Ongkir + Biaya Layanan Escrow (transparan)
      • CTA: "Bayar dengan Escrow 🔒" + microcopy "Dana aman, cair setelah barang kamu terima"
  → Payment page (hosted payment gateway: VA/QRIS/e-wallet)
```

### 4.4 Escrow Lifecycle (timeline yang terlihat di /orders/[id])
```
🔵 Menunggu Pembayaran  →  (bayar)
🟢 Dana Ditahan Escrow  →  seller: "Kirim barang & input resi"
🟡 Dalam Pengiriman     →  tracking resi otomatis
🟠 Paket Tiba           →  buyer: inspeksi 2×24 jam
   [Konfirmasi OK]  atau  [Ajukan Komplain]
🟣 Selesai              →  dana cair ke seller → muncul prompt "Beri Ulasan ⭐"
```

### 4.5 Nego (Offer)
```
Detail listing → "Tawar Harga" → input harga (+ quick chips -10%/-20%)
  → Seller menerima notifikasi + pesan otomatis di chat
  → Seller: Terima / Tolak / Kasih harga lain (counter)
  → Diterima → harga listing ter-lock untuk buyer itu → tombol "Checkout dengan harga nego"
  → Offer kedaluwarsa 24 jam
```

### 4.6 Dispute
```
Order page → "Ada masalah? Ajukan Komplain"
  → Pilih alasan (barang tidak sesuai / tidak dikirim / rusak / dll.)
  → Upload bukti foto/video unboxing
  → Status: "Diproses — admin akan meninjau maks. 2×24 jam"
  → Admin mediasi: keputusan + catatan → dana kembali (REFUNDED) atau cair (COMPLETED)
```

### 4.7 Withdraw Saldo Seller
```
Wallet → "Tarik Dana" → pilih bank/e-wallet → input nominal → PIN/OTP → status processing → success
```

---

## 5. Spesifikasi Halaman Kunci

### 5.1 Home
- **Header**: logo, search bar, ikon notifikasi + chat (badge unread), avatar
- **Hero**: carousel promo + banner edukasi escrow ("Jual beli tanpa waswas")
- **Kategori chips** (icon + label)
- **Section**: "Baru Diposting" (horizontal scroll), "Dekat Kamu" (by lokasi), "Dari Penjual Terverifikasi"
- **Bottom nav (mobile)**: Beranda | Kategori | ➕ Jual (CTA tengah menonjol) | Chat | Akun
- **Feed**: card listing (foto 1:1, harga, judul 2 baris, lokasi, badge nego/verified) — infinite scroll (cursor pagination)

### 5.2 Detail Produk
- Sticky bottom bar: [Chat] [Tawar] [Beli Sekarang]
- Foto: swipeable, pinch zoom, indikator kondisi di overlay foto pertama
- Info penjual: kartu dengan trust score & tombol "Lihat Profil"
- Bagian "Alasan beli aman di sini": ikon escrow, garansi dana, verifikasi

### 5.3 Chat
- List conversation: avatar, nama, preview pesan terakhir, timestamp, unread badge, label listing terkait
- Thread: bubble pesan, kartu listing, kartu offer (status: Ditawar/Diterima/Kedaluwarsa), indikator typing, read receipt (✓✓ dibaca)
- Input: teks + lampiran foto + tombol tawar harga

### 5.4 Orders (Pesanan Saya)
- Tab: Berjalan | Selesai | Dibatalkan | Komplain
- Card order: foto item, judul, total, status chip berwarna, countdown (mis. "Bayar dalam 03:12:44"), tombol aksi kontekstual:
  - PENDING_PAYMENT → [Bayar Sekarang]
  - FUNDED (seller view) → [Input Resi]
  - SHIPPED → [Lacak Paket] + [Konfirmasi Terima]
  - DELIVERED/INSPECTING → [Konfirmasi OK] + [Ajukan Komplain]
  - COMPLETED → [Beri Ulasan]

### 5.5 Verifikasi Akun
- Progress step: Email ✅ → HP ✅ → KTP + Selfie ⬜ → Menunggu Review ⏳
- Upload KTP: panduan frame + validasi blur/gelap (frontend check)
- Hasil: badge ✅ "Terverifikasi" di profil & listing

### 5.6 Admin Panel
- Dashboard: KPI cards (GMV hari ini, transaksi aktif, dispute terbuka, user baru)
- Tabel data dengan filter/search; dispute console: dua kolom (bukti buyer vs seller), aksi resolve + catatan wajib
- Semua aksi → audit log; konfirmasi modal untuk aksi destruktif

---

## 6. Microcopy (Bahasa Indonesia)

| Konteks | Copy |
|---|---|
| CTA checkout | "Bayar dengan Escrow 🔒" |
| Subtext escrow | "Dana kamu ditahan aman. Baru cair ke penjual setelah barang kamu terima." |
| Inspeksi | "Cek dulu barangnya, santai. Kamu punya waktu 2 hari." |
| Offer diterima | "Yeay! Tawaran kamu diterima 🎉 Checkout sekarang sebelum kedaluwarsa." |
| Offer ditolak | "Yah, tawaran ditolak. Coba tawar lagi atau chat si penjual~" |
| Dispute | "Tenang, tim kami bantu mediasi. Upload bukti unboxing ya." |
| Empty search | "Hmm, barang yang kamu cari belum ada. Coba kata kunci lain?" |

---

## 7. State & Error Handling (Ringkas)

| Skenario | Handling |
|---|---|
| Payment expired | Auto-cancel order + listing kembali aktif + notifikasi |
| Seller tidak kirim >72 jam | Buyer boleh cancel/refund otomatis |
| Resi invalid/tidak terlacak | Flag ke seller untuk koreksi; jika >5 hari tidak valid → dispute otomatis |
| Webhook payment duplikat | Idempotency key → response OK tanpa double-process |
| Koneksi chat putus | Socket.io auto-reconnect + fetch ulang pesan via REST |
| Upload foto gagal | Retry + kompresi ulang; thumbnail placeholder |

---

## 8. Accessibility & Performance

- Kontras warna AA (cek Design_System)
- Semua gambar: lazy-load, WebP/AVIF, LQIP placeholder
- Form: label eksplisit, error message terikat `aria-describedby`
- Reduced motion respect untuk animasi
- Target: LCP < 2.5s di 4G, INP < 200ms

---

> Wireframe hi-fi & prototype (Figma) direferensikan terpisah. Dokumen ini adalah single source of truth untuk perilaku; jika konflik dengan visual design, diskusikan & update kedua dokumen.
