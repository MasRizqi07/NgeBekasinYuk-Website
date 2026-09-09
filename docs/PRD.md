# 📦 PRD — "NgeBekasinYuk" Marketplace Barang Bekas Teknologi

## 1. Overview & Visi
Platform e-commerce C2C khusus barang bekas teknologi untuk pasar Indonesia. Fokus utama: keamanan transaksi via escrow (anti tipu-tipu) + kemudahan jual-beli dengan gaya UI/UX lokal yang familiar.

### Masalah yang dipecahkan
- Jual beli barang bekas tech di marketplace umum sering kena penipuan (transfer langsung, barang beda)
- Tidak ada kategori & filter spesifik untuk barang tech bekas (kondisi, garansi tersisa, umur pemakaian)
- Minimnya sistem reputasi & verifikasi penjual

### Solusi
- Escrow payment: dana ditahan sistem → barang diterima & diverifikasi → dana cair ke penjual
- Verifikasi akun + badge terpercaya
- Rating & review pasca-transaksi
- Chat negotiation built-in

## 2. Target Market
| Aspek | Detail |
| --- | --- |
| Pasar | Indonesia (phase 1: urban, Jabodetabek & kota besar) |
| User awal | 10.000 user (DAU est. 2.000–3.000) |
| Persona penjual | Anak tech upgrade rutin, kolektor, toko refurbish kecil |
| Persona pembeli | Cari gadget murah tapi takut ketipu, anak kuliahan, gamers |

## 3. Feature Requirements

### 3.1 Auth & User Management
- Register/login via email + password, Google OAuth, nomor HP (OTP)
- Verifikasi KTP + selfie (e-KYC) → unlock badge ✅ Terverifikasi
- Profile: foto, bio, alamat (multi), rekening/e-wallet untuk pencairan dana
- Trust score: kombinasi rating, jumlah transaksi sukses, umur akun, status verifikasi

### 3.2 Listing Produk
- CRUD listing dengan upload foto (min 1, max 10) — kompresi otomatis, multiple angle
- Field khusus barang tech bekas:
  - Kategori (Smartphone, Laptop, Audio, Console, PC Parts, Wearables, dll.)
  - Kondisi (Seperti baru / Pemakaian wajar / Lecet pemakaian / Rusak minor — dengan deskripsi wajib)
  - Merek & model (dropdown + autocomplete dari DB katalog produk)
  - Umur pemakaian, garansi tersisa, kelengkapan (dus, charger, kabel)
- Harga (fixed) + toggle "Bisa nego"
- Lokasi (kota/kabupaten)
- Status listing: draft / aktif / terjual / nonaktif
- Boost/promote listing (nice-to-have phase 2, monetization)

### 3.3 Search, Discovery & Filter
- Full-text search (nama, deskripsi, merek, model)
- Filter: kategori, rentang harga, kondisi, lokasi (provinsi/kota), badge penjual terverifikasi, "bisa nego", sort (terbaru, termurah, termahal, paling dekat)
- Halaman kategori + produk terkait
- Rekomendasi "Baru dilihat" & "Mungkin kamu suka" (phase 2, collaborative filtering)

### 3.4 Chat & Nego
- Real-time chat buyer ↔ seller (WebSocket)
- Fitur tawar harga (nego) — kirim penawaran harga → seller accept/counter/reject
- Lampirkan listing di chat (rich card)
- Report & block user, filter kata kasar

### 3.5 Cart & Checkout
- Cart multi-seller (per seller jadi satu "order group")
- Checkout → ringkasan biaya: harga barang + ongkir (integrasi kurir) + biaya layanan escrow
- Catatan untuk penjual

### 3.6 Pembayaran Escrow 🔐 (Core Differentiator)
- Flow:
  1. Buyer bayar → dana masuk rekening penampung (escrow), status FUNDED
  2. Seller kirim barang + input nomor resi → status SHIPPED
  3. Buyer konfirmasi terima → ada masa inspeksi (misal 2×24 jam)
  4. Selesai inspeksi / buyer konfirmasi OK → status RELEASED → dana cair ke saldo seller
- Refund flow jika barang tidak sesuai → dispute resolution
- Integrasi payment gateway: Midtrans/Xendit (VA, e-wallet, QRIS, CC)
- Saldo seller bisa ditarik (withdraw) ke bank/e-wallet
- Dispute center: buyer buka tiket, upload bukti foto/video, admin mediasi

### 3.7 Rating & Review
- Review hanya untuk user yang transaksi escrow selesai (verified purchase)
- Rating bintang 1–5 + teks + foto
- Review muncul di profile seller & listing
- Seller bisa reply review

### 3.8 Manajemen Pesanan & Pengiriman
- Status: PENDING_PAYMENT → FUNDED → SHIPPED → DELIVERED → INSPECTING → COMPLETED / DISPUTED / REFUNDED / CANCELLED
- Integrasi kurir: RajaOngkir / Shipper / cek resi otomatis (webhook status pengiriman)
- Notifikasi tiap perubahan status (in-app + email + WA opsional)
- Halaman "Pesanan Saya" & "Penjualan Saya" dengan tab status

### 3.9 Notifikasi
- In-app notification center + unread badge
- Email (transactional): Transaksi, topik
- Phase 2: push notification (FCM), WhatsApp (via gateway)

### 3.10 Admin Panel (Backoffice)
- Dashboard: GMV, transaksi, user aktif, dispute terbuka
- User management (suspend, verifikasi manual, badge)
- Listing moderation (report queue, hapus listing melanggar)
- Dispute resolution console
- CMS: kategori, banner, katalog merek/model
- Audit log semua aksi admin

## 4. Non-Functional Requirements
| Aspek | Target |
| --- | --- |
| Performance | TTFB < 600ms, API p95 < 300ms, Lighthouse > 90 |
| Availability | 99.9% (K8s multi-replica, health checks) |
| Security | OWASP ASVS, rate limiting, RBAC, encryption at rest, PCI-DSS via gateway |
| Scalability | Horizontal pod autoscaling, DB connection pooling, Redis cache |
| SEO | SSR (Next.js), sitemap, structured data Product schema |

## 5. Tech Stack (Final)
**Frontend**
- Next.js 14+ (App Router) + React + TypeScript
- Tailwind CSS + shadcn/ui + Framer Motion
- TanStack Query (data fetching) + Zustand (state)
- React Hook Form + Zod (validation)
- Socket.io-client (chat real-time)

**Backend**
- NestJS (Node 20 LTS) + TypeScript
- PostgreSQL 15+ (primary) — via Prisma ORM
- Redis — cache, session store, Socket.io adapter, rate limit, queue (BullMQ)
- BullMQ + worker service (image processing, notifications, webhooks)
- MinIO / S3-compatible (object storage untuk foto) — atau AWS S3
- Keycloak / atau JWT + refresh token (stateless, refresh di Redis)

**Integrasi**
- Midtrans / Xendit (payment + escrow-like flow)
- RajaOngkir / Shipper (ongkir & resi)

**Infrastructure (Docker + K8s)**
- Docker multi-stage builds → deploy ke K8s
- Nginx Ingress + cert-manager (TLS)
- Helm charts, namespaces: prod, staging
- CI/CD: GitHub Actions (build, test, push image, deploy)
- Observability: Prometheus + Grafana + Loki, Sentry (error tracking)
- Backup: WAL archiving PostgreSQL, snapshot harian

## 6. Arsitektur Sistem (High Level)
```text
                        ┌─────────────┐
   Client (Next.js SSR) │   Ingress   │
           │            └──────┬──────┘
           ▼                   │
   ┌──────────────┐            ▼
   │  Next.js App │    ┌───────────────┐    ┌────────────┐
   │  (Vercel-ish)│───▶│  NestJS API   │───▶│ PostgreSQL │
   └──────────────┘    │   (REST API)  │    └────────────┘
                       └──────┬───────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌───────────┐  ┌───────────┐
        │  Redis   │  │  Workers  │  │  Socket   │
        │cache/bull│  │ (BullMQ)  │  │  Gateway  │
        └──────────┘  └───────────┘  └───────────┘
              ▲              ▲              ▲
        ┌─────┴──────┐  ┌────┴─────┐  ┌─────┴──────┐
        │   MinIO/   │  │ Midtrans │  │  RajaOngkir │
        │     S3     │  │ /Xendit  │  │  /Shipper   │
        └────────────┘  └──────────┘  └────────────┘
```

**Struktur monorepo:**
```text
ngebekasinyuk/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── api/          # NestJS backend
│   ├── worker/       # BullMQ workers
│   ├── socket/       # Socket.io gateway (bisa di-merge ke api)
│   └── admin/        # Admin panel (Next.js terpisah)
├── packages/
│   ├── shared/       # DTO, types, constants, enums (shared)
│   ├── config/       # eslint, tsconfig
│   └── ui/           # (opsional) komponen shared
├── infra/
│   ├── docker/       # Dockerfiles
│   ├── k8s/          # manifests / helm
│   └── .github/      # CI/CD workflows
└── docker-compose.yml # dev environment
```

## 7. Data Model (Utama)
```text
users ──(1:N)── listings ──(1:N)── listing_images
users ──(1:N)── orders ──(1:N)── order_items ──(N:1)── listings
orders ──(1:1)── payments ──(1:N)── payment_logs
orders ──(1:N)── shipments
orders ──(1:N)── disputes ──(1:N)── dispute_evidences
users ──(1:N)── reviews (target_user_id, order_id)
users ──(1:N)── conversations ──(1:N)── messages
users ──(1:N)── addresses
users ──(1:N)── withdrawals

categories (tree), brands, catalog_products
notifications
admin_users (atau role di users)
audit_logs
```
*Key indexes:* listings(category_id, status, price), listings(geolocation/GIN full-text), orders(buyer_id, status), orders(seller_id, status), messages(conversation_id, created_at).

## 8. Implementation Plan

- **🟢 Phase 0 — Foundation (Minggu 1–2)**
  - Setup monorepo (Turborepo/pnpm workspaces), lint, prettier, husky
  - Docker compose dev (PostgreSQL, Redis, MinIO)
  - Setup CI/CD pipeline dasar (lint + test di GitHub Actions)
  - Design system + layout base (Next.js + Tailwind + shadcn)

- **🟢 Phase 1 — Auth & User (Minggu 2–4)**
  - Auth API (register, login, refresh, OAuth Google)
  - Verifikasi email/HP (OTP via gateway)
  - Profile & alamat management
  - Frontend: auth pages, profile page
  - e-KYC flow + badge verifikasi (queue worker untuk review, phase 1 manual dulu)

- **🟢 Phase 2 — Listing & Discovery (Minggu 4–7)**
  - CRUD listing API + upload foto (direct-to-S3 presigned URL, worker kompresi)
  - Full-text search (PostgreSQL tsvector dulu, Elasticsearch kalau perlu scale)
  - Filter & sort + pagination
  - Frontend: home, kategori, detail produk, create/edit listing, "Listing Saya"

- **🟢 Phase 3 — Chat & Nego (Minggu 7–9)**
  - Socket.io gateway (Redis adapter buat multi-replica)
  - 1-on-1 chat + read receipt + typing indicator
  - Fitur nego (offer → accept/counter/reject → lock harga)
  - Frontend: chat page + floating chat widget

- **🟢 Phase 4 — Checkout & Escrow (Minggu 9–13) 🔐**
  - Cart + checkout flow
  - Integrasi payment gateway (Midtrans/Xendit) — snap/checkout API + webhook handler
  - State machine order (backend core — paling kritis, wajib unit test 90%+)
  - Shipping: cek ongkir, create shipment, resi, webhook status kurir
  - Buyer confirm → release dana (worker scheduled untuk auto-release setelah inspeksi)
  - Withdraw saldo seller
  - Frontend: cart, checkout, pembayaran, tracking pesanan

- **🟢 Phase 5 — Review, Dispute & Notifikasi (Minggu 13–15)**
  - Review post-transaksi
  - Dispute center + evidence upload
  - Notifikasi in-app + email (queue-based)
  - Frontend: review modal, halaman dispute, notification center

- **🟢 Phase 6 — Admin Panel (Minggu 15–17)**
  - Dashboard metrik
  - Moderasi user & listing
  - Dispute resolution console
  - CMS kategori/banner
  - Audit log

- **🟢 Phase 7 — Hardening & Launch (Minggu 17–19)**
  - Security audit (rate limit, helmet, input sanitization, dependency scan)
  - Load testing (k6) & optimization
  - Observability penuh (Grafana dashboards, Sentry, log aggregation)
  - Backup & disaster recovery plan
  - Deploy production ke K8s + smoke test + soft launch 🚀

## 9. Milestones & Estimasi
| Milestone | Deliverable | Timeline |
| --- | --- | --- |
| M1 | Auth & profile jalan | Akhir minggu 4 |
| M2 | Listing & search MVP usable | Minggu 7 |
| M3 | Chat + nego live | Minggu 9 |
| M4 | Full transaksi escrow end-to-end | Minggu 13 |
| M5 | Beta (invite 100 user internal) | Minggu 17 |
| M6 | 🚀 Public launch 10K user | Minggu 19–20 |
*(Estimasi tim ideal: 1 FE, 1 BE, 1 full-stack/UI, 1 DevOps (atau lo sendiri kalau full-stack solo → timeline bisa 2–3× lipat).*

## 10. Risiko & Mitigasi
| Risiko | Mitigasi |
| --- | --- |
| Chargeback/fraud di escrow | KYC wajib untuk withdraw, limit transaksi awal akun baru, hold manual untuk transaksi besar |
| Integrasi kurir tidak stabil | Abstract ke adapter pattern, fallback manual input resi |
| Dispute abuse | Bukti wajib foto/video unboxing, SLA respon, mediasi admin |
| Cost image storage | Kompresi otomatis, lifecycle policy S3 (archive) |
| Scaling chat | Redis adapter + sticky sessions via Ingress. |
