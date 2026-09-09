# Design System — NgeBekasinYuk

> Design tokens, komponen, dan style guide untuk NgeBekasinYuk. Mengacu ke pendekatan **token → komponen → pattern**, dibangun di atas **Tailwind CSS + shadcn/ui**, dengan sentuhan visual **marketplace Indonesia: cerah, ramah, trustful**.

---

## 1. Design Tokens

### 1.1 Warna (Brand & Semantic)

| Token | Hex | Kegunaan |
|---|---|---|
| `brand-primary` | `#0F6FFF` | CTA utama, link, elemen aktif (biru trust) |
| `brand-primary-hover` | `#0A5BD6` | Hover state |
| `brand-secondary` | `#00C48C` | Aksi positif/sukses escrow, "Beli Sekarang" alternatif |
| `accent` | `#FF7A00` | CTA "Jual" (menonjol), highlight promo |
| `danger` | `#E5484D` | Error, batal, komplain |
| `warning` | `#F5A524` | Pending, countdown, peringatan lembut |
| `info` | `#7C8DB0` | Neutral info |

### Surface & Text

| Token | Hex |
|---|---|
| `bg-app` | `#F7F8FA` (abu sangat muda, khas marketplace ID) |
| `bg-card` | `#FFFFFF` |
| `bg-subtle` | `#EFF2F6` |
| `border` | `#E3E8EF` |
| `text-primary` | `#1A1D23` |
| `text-secondary` | `#5C6575` |
| `text-muted` | `#8A94A6` |
| `text-inverse` | `#FFFFFF` |

### Status Order (chip colors)

| Status | BG | Text |
|---|---|---|
| PENDING_PAYMENT | `#FFF4E0` | `#B26A00` |
| FUNDED | `#E7F6EE` | `#0E7C4A` |
| SHIPPED | `#EAF2FF` | `#0F6FFF` |
| DELIVERED/INSPECTING | `#F0EBFF` | `#5B3BB8` |
| COMPLETED | `#E7F6EE` | `#0E7C4A` |
| DISPUTED | `#FDECEC` | `#C43232` |
| CANCELLED/REFUNDED | `#F1F3F7` | `#5C6575` |

### 1.2 Tipografi

Font: **Inter** (UI Latin) + fallback sistem. Skala:

| Token | Size / Line | Weight | Contoh penggunaan |
|---|---|---|---|
| `display` | 32/40 | 700 | H1 halaman |
| `h1` | 24/32 | 700 | Judul halaman |
| `h2` | 20/28 | 600 | Section header |
| `h3` | 16/24 | 600 | Card title, listing title |
| `body-lg` | 16/24 | 400 | Body utama |
| `body` | 14/20 | 400 | Body default |
| `caption` | 12/16 | 400 | Metadata, lokasi, timestamp |
| `price` | 20/28 | 700 | Harga listing (variant numerik tabular: `font-feature-settings: "tnum"`) |

### 1.3 Spacing & Radius

- Base unit: **4px** — skala: 4, 8, 12, 16, 20, 24, 32, 40, 48
- Radius: `sm 6px`, `md 10px`, `lg 14px`, `xl 20px`, `full 9999px`
- Card: `bg-card` + radius `lg` + border `1px border` + shadow subtle (`0 1px 2px rgba(16,24,40,.06)`)

### 1.4 Shadow & Elevation

| Token | Value | Dipakai |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(16,24,40,.06)` | Card |
| `shadow-md` | `0 4px 12px rgba(16,24,40,.10)` | Dropdown, popover |
| `shadow-lg` | `0 12px 32px rgba(16,24,40,.16)` | Bottom sheet, modal |
| `shadow-cta` | `0 4px 14px rgba(15,111,255,.35)` | CTA primary (hover glow halus) |

### 1.5 Motion

- Easing: `ease-out` untuk masuk, `ease-in` untuk keluar
- Durasi: fast 150ms (hover/press), base 250ms (transisi halaman), slow 400ms (bottom sheet/modal)
- Interaksi utama: press scale `0.97` (button), skeleton shimmer saat loading
- Respect `prefers-reduced-motion`

---

## 2. Komponen (Library: shadcn/ui + custom)

### 2.1 Komponen Dasar (dari shadcn/ui, di-theme-kan)
Button, Input, Textarea, Select, Checkbox, Radio, Switch, Dialog/Modal, Dropdown, Tabs, Badge, Toast, Tooltip, Skeleton, Avatar, Form (RHF+Zod wrapper).

### 2.2 Komponen Khusus NgeBekasinYuk

| Komponen | Deskripsi | State |
|---|---|---|
| `ListingCard` | Foto 1:1, badge Nego/Verified, harga, judul, lokasi, waktu | hover: shadow-md; press → detail |
| `PriceTag` | Harga format Rupiah, tabular-nums, optional coret harga coret + chip diskon | — |
| `TrustBadge` | ✅ Terverifikasi (hijau), ⭐ Trust score (kuning) | tooltip penjelasan |
| `SellerCard` | Avatar, nama, badge, trust score, "Bergabung ...", tombol ikuti/chat | — |
| `OfferCard` (chat) | Harga tawaran, tombol Terima/Tolak/Counter (seller) atau status chip (buyer) | PENDING/ACCEPTED/REJECTED/EXPIRED |
| `OrderStatusChip` | Chip status order sesuai tabel warna status | sesuai state machine |
| `OrderTimeline` | Vertikal stepper: Bayar → Escrow → Kirim → Terima → Selesai (+ aktif/countdown) | current step pulse |
| `CountdownBadge` | HH:MM:SS countdown (payment deadline, offer expiry) | warning saat < 1 jam |
| `RatingStars` | Input 1–5 bintang (interaktif) & display | hover animasi |
| `ReviewCard` | Bintang, teks, foto, seller reply, badge "Pembelian terverifikasi" | — |
| `EmptyState` | Ilustrasi + judul + deskripsi + CTA | — |
| `ImageUploader` | Grid upload, drag reorder, kompres indicator, hapus | uploading → progress |
| `FilterSheet` | Bottom sheet filter (mobile) / sidebar (desktop) | chips aktif count |
| `EscrowBanner` | Banner edukasi escrow di checkout & detail produk | dismissible |
| `PriceOfferSheet` | Sheet input tawar harga + quick chips | — |

### 2.3 Layout Pattern

- **Container**: max-width 1200px (desktop), 16px padding mobile
- **Bottom Nav (mobile)**: fixed, tinggi 64px + safe-area, CTA "Jual" tengah elevated (warna `accent`, bentuk rounded-full)
- **Sticky action bar** di detail produk & checkout
- **Card grid**: 2 kolom mobile, 4–5 kolom desktop, gap 12–16px

---

## 3. Style Guide per Elemen

### Button

| Variant | Style | Dipakai |
|---|---|---|
| Primary | `brand-primary`, text inverse, shadow-cta | Bayar, Simpan, Login |
| Secondary | outline brand, bg white | Chat, Filter |
| Success | `brand-secondary` | Konfirmasi Terima, Terima Tawaran |
| Destructive | `danger` | Batal order, Hapus listing |
| Accent (FAB) | `accent`, full rounded | ➕ Jual |
| Ghost | transparent, text-secondary | minor actions |

- Size: `sm 36px`, `md 44px` (default, mobile-friendly), `lg 52px` (CTA utama checkout)
- Loading: spinner menggantikan label, disabled state opacity 60%

### Form
- Input: radius `md`, border `border`, focus ring 2px `brand-primary` 30%
- Error: border `danger` + teks `danger` 12px di bawah + ikon ⚠
- Label selalu terlihat (bukan placeholder-only) untuk aksesibilitas

### Badge / Chip
- Tinggi 24–28px, radius full, font caption 600
- Contoh: "Bisa Nego" (outline accent), "✅ Terverifikasi" (bg hijau muda)

### Toast (global feedback)
- Success: hijau — "Tawaran terkirim 🎉"
- Error: merah — "Gagal upload foto, coba lagi ya"
- Info: netral — "Listing disimpan sebagai draft"

### Modal & Bottom Sheet
- Mobile: bottom sheet (slide-up), drag-to-close
- Desktop: centered modal, backdrop blur
- Konfirmasi destruktif: judul jelas + teks penjelasan + tombol danger di kanan

### Ikonografi
- Set: **Lucide** (outline, stroke 1.75–2, konsisten dengan shadcn)
- Ikon kunci: Shield (escrow), BadgeCheck (verifikasi), MessageCircle (chat), HandCoins/Tag (nego), Truck (kirim), Star (rating), Wallet (saldo), Camera (jual), Search, Bell, Plus

---

## 4. Ilustrasi & Empty State

- Gaya: flat illustration, warna brand + netral, karakter ramah
- Empty state wajib: search kosong, chat kosong, order kosong, notifikasi kosong, cart kosong (dengan CTA "Mulai Belanja")
- Edukasi escrow: ilustrasi perisai + alur 3 langkah sederhana (Bayar → Cek Barang → Dana Cair)

---

## 5. Dark Mode (Phase 2)

Token surface diinversikan: `bg-app` → `#0F1216`, card → `#171B21`, border → `#262C36`, teks disesuaikan. Semua token didefinisikan via CSS variables agar toggle sekali klik. (Prioritas setelah launch.)

---

## 6. Implementasi Teknis

- Tokens didefinisikan sebagai **CSS variables** di `packages/ui/tokens.css` + dipetakan ke Tailwind config (`tailwind.config.ts` mengambil dari token, bukan hardcode).
- Komponen custom NgeBekasinYuk berada di `packages/ui/src/` — dibangun di atas Radix primitives (sama seperti shadcn/ui) untuk aksesibilitas.
- Storybook (opsional tapi direkomendasikan) di `packages/ui` untuk dokumentasi visual komponen.

```css
:root {
  --brand-primary: 0.006 0.263 1.0; /* oklch */
  /* ...semua token... */
}
```

> **Aturan emas**: tidak ada hardcode warna/spacing di feature code. Semua harus lewat token. 🎯
