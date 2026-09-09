# NgeBekasinYuk — Marketplace Barang Bekas Teknologi

> Platform e-commerce C2C (consumer-to-consumer) khusus jual-beli barang bekas teknologi dengan **escrow payment** — dana ditahan sistem sampai barang diterima & diverifikasi buyer. Anti tipu-tipu. 🔐

[![Stack](https://img.shields.io/badge/Stack-Next.js%20%2B%20NestJS%20%2B%20PostgreSQL%20%2B%20Redis-blue)]()
[![Deployment](https://img.shields.io/badge/Deploy-Docker%20%2B%20Kubernetes-326ce5)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

---

## 📌 Tentang Project

NgeBekasinYuk adalah platform digital untuk jual-beli barang bekas teknologi (smartphone, laptop, audio, console gaming, PC parts, wearables, dll) untuk pasar Indonesia. Beda dengan marketplace umum, NgeBekasinYuk menawarkan:

- **🔐 Escrow Payment** — dana buyer ditahan sistem, baru cair ke seller setelah barang diterima & lolos masa inspeksi
- **✅ Verifikasi Akun & Badge Terpercaya** — e-KYC + trust score
- **⭐ Rating & Review Terverifikasi** — hanya dari transaksi nyata
- **💬 Chat + Nego Real-time** — tawar harga langsung built-in
- **🛡️ Dispute Center** — mediasi admin jika barang tidak sesuai

## 🎯 Target

- Pasar: Indonesia (phase 1: urban Jabodetabek & kota besar)
- Skala awal: 10.000 user (est. DAU 2.000–3.000)
- Availability target: 99.9%

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 14+ (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, React Hook Form + Zod, Socket.io-client |
| Backend | NestJS (Node 20 LTS), TypeScript, Prisma ORM, BullMQ |
| Database | PostgreSQL 15+ |
| Cache / Queue | Redis (cache, session, rate limit, BullMQ, Socket.io adapter) |
| Storage | MinIO (dev) / AWS S3 (prod) — foto listing |
| Real-time | Socket.io (Redis adapter) |
| Payment | Midtrans / Xendit (VA, e-wallet, QRIS, CC) |
| Shipping | RajaOngkir / Shipper (cek ongkir + webhook resi) |
| Auth | JWT access + refresh token (stateless, refresh di Redis), Google OAuth |
| Infra | Docker, Kubernetes (Helm), Nginx Ingress, cert-manager, GitHub Actions CI/CD |
| Observability | Prometheus + Grafana + Loki, Sentry |

---

## 📁 Struktur Monorepo

```
ngebekasinyuk/
├── apps/
│   ├── web/          # Next.js frontend (buyer/seller)
│   ├── api/          # NestJS REST API
│   ├── worker/       # BullMQ background workers
│   ├── socket/       # Socket.io real-time gateway
│   └── admin/        # Admin backoffice (Next.js)
├── packages/
│   ├── shared/       # DTO, types, enums, constants (dipakai semua app)
│   ├── config/       # shared eslint, tsconfig
│   └── ui/           # komponen UI shared (opsional)
├── infra/
│   ├── docker/       # Dockerfiles multi-stage
│   ├── k8s/          # Helm charts / manifests
│   └── github/       # CI/CD workflows
├── docs/             # dokumentasi (file-file ini)
├── docker-compose.yml
├── pnpm-workspace.yaml / turbo.json
└── package.json
```

---

## 🚀 Quick Start (Development)

### Prerequisite
- Node.js 20 LTS
- pnpm 9+
- Docker & Docker Compose

### 1. Clone & install
```bash
git clone https://github.com/<org>/ngebekasinyuk.git
cd ngebekasinyuk
pnpm install
```

### 2. Jalankan infrastruktur lokal (PostgreSQL, Redis, MinIO)
```bash
docker compose up -d
```

### 3. Setup environment
```bash
cp .env.example .env          # isi credential
pnpm --filter api db:migrate  # jalankan migrasi Prisma
pnpm --filter api db:seed     # seed data kategori & katalog
```

### 4. Jalankan semua app
```bash
pnpm dev
```

| App | URL |
|---|---|
| Web (buyer/seller) | http://localhost:3000 |
| API + Swagger | http://localhost:4000/api/docs |
| Admin panel | http://localhost:3001 |
| MinIO Console | http://localhost:9001 |
| Socket gateway | http://localhost:4001 |

---

## 🧪 Testing & Quality

```bash
pnpm lint              # eslint semua workspace
pnpm test              # unit test semua workspace
pnpm test:e2e          # e2e (Playwright)
pnpm build             # build production semua app
```

- Unit test coverage target: **min. 80%** (core escrow/order state machine: **90%+**)
- e2e: Playwright — flow kritis (register → listing → chat → checkout → escrow → release)

---

## 🚢 Deployment (Production — Docker + K8s)

### CI/CD Flow (GitHub Actions)
1. Push ke `main` → lint + test
2. Build Docker image multi-stage → push ke registry (GHCR)
3. Deploy ke K8s via Helm: namespace `staging` (auto), `prod` (manual approval)

### Arsitektur Deployment
- Namespace: `prod`, `staging`
- Ingress: Nginx + cert-manager (Let's Encrypt TLS)
- HPA: autoscaling berdasarkan CPU/RPS
- Backup: WAL archiving PostgreSQL + snapshot harian
- Monitoring: Grafana dashboards, alert ke Slack/Telegram

Lihat detail di [Architecture.md](./Architecture.md) dan [Business_Flow.md](./Business_Flow.md).

---

## 📚 Dokumentasi

| File | Isi |
|---|---|
| [Architecture.md](./Architecture.md) | Arsitektur sistem, data model, infrastruktur, keamanan |
| [Design.md](./Design.md) | UX flow, wireframe-level flow, halaman & interaksi |
| [Design_System.md](./Design_System.md) | Design tokens, komponen, iconografi, style guide |
| [Business_Flow.md](./Business_Flow.md) | Flow bisnis end-to-end: escrow, dispute, refund, nego |

---

## 🔐 Keamanan

- Semua input divalidasi (class-validator + Zod di frontend)
- Rate limiting di Redis (per IP + per user)
- Password: bcrypt/argon2
- JWT access token (15 menit) + refresh token rotation (Redis)
- RBAC: BUYER, SELLER, ADMIN, SUPER_ADMIN
- PII terenkripsi at-rest, HTTPS everywhere (TLS via cert-manager)
- PCI-DSS scope diminimalkan — kartu ditangani penuh oleh payment gateway
- Audit log semua aksi admin & transaksi finansial

---

## 🗺️ Roadmap

| Phase | Fitur | Status |
|---|---|---|
| P1 | Auth, profile, verifikasi | 🚧 |
| P2 | Listing, foto, search & filter | ⬜ |
| P3 | Chat & nego real-time | ⬜ |
| P4 | Cart, checkout, escrow, shipping | ⬜ |
| P5 | Review, dispute, notifikasi | ⬜ |
| P6 | Admin panel | ⬜ |
| P7 | Hardening & launch | ⬜ |
| P8 | Promote/boost listing (monetization), push notif WA | ⬜ |
| P9 | Rekomendasi ML, escrow instan, fitur lelang | ⬜ |

---

## 🤝 Kontribusi

1. Fork repo
2. Buat branch: `git checkout -b feat/nama-fitur`
3. Commit dengan conventional commits: `feat:`, `fix:`, `chore:`, dll
4. PR ke `main` — wajib pass CI (lint + test + build)

---

## 📄 License

MIT License — bebas dipakai untuk belajar & produksi.
