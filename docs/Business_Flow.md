# Business Flow — NgeBekasinYuk

> Dokumen ini mendefinisikan **alur bisnis end-to-end** NgeBekasinYuk: dari listing sampai dana cair, termasuk escrow lifecycle, nego, dispute, refund, dan monetization. Merupakan acuan implementasi backend (state machine) dan SOP operasional.

---

## 1. Flow Jual (Seller Journey)

```
1. REGISTER & VERIFIKASI
   Register → verifikasi email/HP → (WAJIB SEBELUM JUAL/WITHDRAW)
   e-KYC: upload KTP + selfie → review (auto/manual) → badge ✅
        → approval: unlock "Jual", withdraw saldo, trust score dasar +20

2. BUAT LISTING
   Foto (min 1, max 10) → detail produk → harga (+opsi nego) → lokasi
   → Publish → status ACTIVE (masuk search & feed)

3. INTERAKSI PEMBELI
   Chat masuk / Penawaran masuk (notifikasi in-app + email)
   → Balas chat / Respons offer: Terima | Counter | Tolak
   → Offer diterima → listing ter-lock harga untuk buyer tsb (2 jam window checkout)

4. TRANSAKSI (lihat §2)
   → Kirim barang → input resi → lacak → dana cair

5. PASCA TRANSAKSI
   Terima review → balas review (opsional)
   → Saldo bertambah (wallet) → Withdraw ke bank/e-wallet (min Rp 10.000)
```

**Aturan seller:**
- Resi wajib valid ≤ 72 jam setelah FUNDED, jika tidak → order auto-cancel + refund buyer + catatan performa seller
- Listing melanggar (barang terlarang, tipu-tipu) → moderasi: warning → suspend → banned
- Trust score naik tiap transaksi sukses (+5), turun tiap dispute kalah (−15) / cancel berulang (−5)

---

## 2. Flow Beli & Escrow Lifecycle (Transaksi Inti)

```
┌─────────┐   beli/nego   ┌─────────┐   bayar (VA/QRIS/ewallet/CC)   ┌──────────┐
│  BUYER  │ ────────────▶ │ CHECKOUT│ ────────────────────────────▶ │ PAYMENT  │
│         │               │  ORDER  │                                 │ GATEWAY  │
└─────────┘               └─────────┘                                 └────┬─────┘
                                                                              │ webhook PAID
┌─────────┐   barang OK   ┌──────────┐   konfirmasi/auto 2×24h   ┌─────────▼─────┐
│  BUYER  │ ◀──────────── │INSPECTING│ ◀──────────────────────── │     FUNDED    │
│         │               │(cek barang)                           │  dana ditahan │
└─────────┘               └────┬─────┘                            └─────────┬─────┘
                               │ barang bermasalah                         │ kirim barang + resi
                               ▼                                           ▼
                        ┌───────────┐                                ┌─────────────┐
                        │  DISPUTE  │ ──mediasi admin──▶ REFUNDED   │   SHIPPED   │
                        │  (§3)     │                    atau       │  (tracking) │
                        └───────────┘                    COMPLETED  └──────┬──────┘
                                                                           │ delivered (webhook kurir)
┌─────────┐   dana cair (ESCROW_RELEASE)                            ┌──────▼──────┐
│ SELLER  │ ◀────────────────────────────────────────────────────── │  DELIVERED  │
│ (wallet)│                                                          └─────────────┘
└─────────┘   → prompt review ⭐ (buyer ↔ seller)
```

### State & Aturan Order

| # | Status | Pemicu | Tindakan Sistem | Batas Waktu |
|---|---|---|---|---|
| 1 | `PENDING_PAYMENT` | Checkout dibuat | Kirim link pembayaran, notif buyer | Auto-cancel 24 jam |
| 2 | `FUNDED` | Webhook PAID (verifikasi signature + idempoten) | Notif seller: kirim barang; dana masuk escrow/held | Seller kirim ≤ 72 jam |
| 3 | `SHIPPED` | Seller input resi (validasi format + cek resi) | Notif buyer + tracking aktif | — |
| 4 | `DELIVERED` | Webhook status kurir = delivered | Notif buyer, mulai countdown inspeksi | — |
| 5 | `INSPECTING` | Buyer konfirmasi terima ATAU auto 2×24 jam setelah delivered | Buyer bisa komplain | 2×24 jam |
| 6 | `COMPLETED` | Buyer konfirmasi OK / auto-release / dispute menang seller | `ESCROW_RELEASE`: dana ke wallet seller (minus fee) + prompt review | — |
| 7 | `DISPUTED` | Buyer buka dispute (hanya dari FUNDED/SHIPPED/DELIVERED/INSPECTING) | Bekukan dana, buka tiket, notif admin | SLA mediasi 2×24 jam |
| 8 | `REFUNDED` | Dispute menang buyer / cancel setelah FUNDED / gagal kirim | Refund penuh ke buyer (payment gateway refund / manual transfer) | — |
| 9 | `CANCELLED` | Cancel sebelum FUNDED, atau expired payment | Lepaskan lock listing, refund jika sudah bayar | — |

### Rincian Biaya (Checkout)

| Komponen | Nilai (contoh awal) | Dibayar |
|---|---|---|
| Harga barang | sesuai listing/offer | Buyer |
| Ongkir | realtime kurir | Buyer |
| **Biaya Layanan Escrow** | 2.5% dari harga barang (min Rp 2.500) — gratis promo launching | Buyer |
| **Fee penjual** | 0–1.5% dari harga jual (phase 2, saat launch gratis) | Seller (dipotong dari pencairan) |
| Payment gateway fee | sesuai provider | Ditanggung platform (masuk hitungan escrow fee) |

> Angka di atas asumsi awal — final ditentukan di Business Model, fee **selalu tampil transparan** sebelum bayar.

---

## 3. Flow Dispute & Mediasi

```
Buyer: [Ajukan Komplain] dari halaman order
  → Pilih kategori: Barang tidak sesuai | Barang rusak | Tidak dikirim | Resi palsu | Lainnya
  → Wajib: deskripsi + minimal 1 bukti (foto/video unboxing, chat, screenshot)
  → Order: DISPUTED (dana beku)

Sistem:
  → Notif seller untuk memberikan tanggapan + bukti (48 jam)
  → Tiket masuk antrian admin (prioritas: > Rp 500.000 atau indikasi fraud)

Admin (console):
  1. Tinjau bukti kedua pihak
  2. (Opsional) minta bukti tambahan / hubungi pihak kurir
  3. Keputusan:
     • RESOLVED_BUYER  → REFUNDED (full/parsial) + review negatif opsional ke seller
     • RESOLVED_SELLER → COMPLETED → dana cair + catatan dispute kalah
  4. Wajib: resolution note + audit log
  → Notifikasi hasil ke kedua pihak + email

Penalti seller (akumulasi):
  - 1 dispute kalah: warning
  - 3 dispute kalah / 90 hari: suspend jual 7 hari
  - Indikasi fraud: banned + blacklist (device fingerprint, rekening, KTP)
```

---

## 4. Flow Nego (Offer)

```
Buyer → Tawar Harga (input / quick chip)
  → Offer PENDING (expired 24 jam, max 3 offer aktif per listing per buyer)
Seller:
  ├─ Terima → offer ACCEPTED → listing lock harga untuk buyer tsb
  │          → tombol checkout khusu di chat "Checkout Rp XXX.XXX" (window 2 jam)
  ├─ Counter → offer COUNTERED → buyer bisa terima counter / counter lagi (max 5 putaran)
  └─ Tolak → offer REJECTED → buyer boleh tawar lagi setelah 6 jam
Perubahan harga listing oleh seller → semua offer PENDING otomatis EXPIRED
Listing terjual / nonaktif → semua offer EXPIRED
```

---

## 5. Flow Dana & Withdraw

```
ESCROW_RELEASE (order COMPLETED)
  → wallet seller: balance += (harga - fee penjual)
  → wallet_transactions: ref order_id

WITHDRAW
  → Seller: min Rp 10.000, pilih bank/e-wallet (terverifikasi atas nama sama dgn KYC)
  → OTP konfirmasi → status PROCESSING → transfer manual/otomatis → SUCCESS/FAILED
  → Reversal otomatis jika FAILED

REFUND
  → Bila < 24 jam sejak PAID & belum settlement: refund via payment gateway
  → Di luar itu: refund manual transfer + evidence upload (outbox audit)
  → Estimasi: 1–3 hari kerja
```

---

## 6. Monetization Roadmap

| Sumber | Phase | Model |
|---|---|---|
| Biaya layanan escrow | P1 (launch) | 2.5%, gratis promo 3 bulan |
| Fee penjual | P2 | 1–1.5% per transaksi sukses |
| Boost/promote listing | P2 | CPM/CPC: listing muncul di home & search top (ditandai "Promoted") |
| Banner & brand placement | P2–P3 | Fixed fee per slot kategori |
| Official refurbisher/store | P3 | B2B plan: multi-user, analytics, prioritas dispute |
| Value-added (cek fisik/inspeksi barang partner) | P3 | Fee per inspeksi |

---

## 7. Metrik Bisnis Utama (North Star & KPI)

| Metrik | Definisi | Target awal |
|---|---|---|
| **GMV** | Total harga barang terjual via escrow/bln | tumbuh MoM 20% |
| **Transaksi sukses** | Order COMPLETED / total order | > 90% |
| **Dispute rate** | Order DISPUTED / order COMPLETED | < 3% |
| **Time-to-cash seller** | COMPLETED → withdraw median | < 24 jam |
| **Listing → terjual** | % listing ACTIVE yang terjual ≤ 30 hari | > 25% |
| **DAU/MAU stickiness** | | > 20% |
| Fraud loss rate | Nilai dispute fraud / GMV | < 0.5% |

---

## 8. Risiko Operasional & Mitigasi (Ringkas)

| Risiko | Mitigasi |
|---|---|
| Fake listing / fraud seller | Wajib e-KYC untuk jual, trust score, escrow menahan dana, verifikasi resi, blacklist lintas identifier |
| Friendly fraud buyer (bohong barang rusak) | Wajib bukti unboxing, masa inspeksi terbatas, batas dispute per akun, pola anomali → review manual |
| Chargeback via CC | 3DS untuk transaksi > threshold, hold pencairan 3–7 hari untuk CC, data evidence siap |
| Seller money mule | Verifikasi rekening = nama KYC, monitoring pola withdraw cepat beruntun |
| Kurir bermasalah | Multi-kurir adapter, evidence dari tracking, klaim asuransi pengiriman |
| Biaya operasional escrow | Escrow fee + hold period mengatur float; rekening penampung terpisah (compliance) |

---

## 9. Kepatuhan (Compliance Note)

- Dana escrow **wajib di rekening khusus penampung**, tidak dicampur dana operasional
- e-KYC mengikuti regulasi PSE / ketentuan perlindungan data (UU PDP) — persetujuan eksplisit user, enkripsi PII
- Barang terlarang dilarang (daftar moderation): alat sadap, IMEI terblokir, barang curian, dll — SOP listing moderation
- Tax reporting (PPh) untuk seller komersial — phase 3

---

> Dokumen ini adalah acuan implementasi business logic (state machine order, worker, admin SOP). Perubahan flow wajib direview bersama tim engineering + ops, dan di-version.
