# Architecture — NgeBekasinYuk

> Dokumen ini menjelaskan arsitektur sistem NgeBekasinYuk: high-level design, microservices/logical separation, data model, komunikasi antar service, infrastruktur, keamanan, dan strategi scaling.

---

## 1. Prinsip Arsitektur

1. **Modular monolith dulu** — NestJS modular, tapi di-deploy sebagai beberapa service terpisah berdasarkan karakteristik workload (API sync vs worker async vs socket long-lived). Ini memberi trade-off yang tepat untuk skala 10K user tanpa complexity microservices penuh.
2. **Stateless services** — session & cache di Redis, storage di object storage → horizontal scaling mudah.
3. **Event-driven untuk side-effects** — transaksi core sinkron; notifikasi, email, image processing, webhook via BullMQ queue.
4. **API-first & contract-based** — REST + OpenAPI, shared types di package `shared`.
5. **GitOps-ready** — semua infra sebagai code (Helm, K8s manifests, Terraform opsional).

---

## 2. High-Level Architecture

```
                        ┌──────────────────┐
   Client (Next.js SSR) │  Nginx Ingress   │  TLS termination, rate limit edge
           │            └────────┬─────────┘
           │                     │
           ▼                     ▼
   ┌──────────────┐     ┌─────────────────┐
   │  apps/web    │     │   apps/api      │   NestJS REST API (stateless)
   │  (Next.js)   │────▶│   (NestJS)      │───┐
   └──────────────┘     └────────┬────────┘   │
                                 │            │
              ┌──────────────────┼────────────┼─────────────────┐
              │                  │            │                 │
              ▼                  ▼            ▼                 ▼
        ┌──────────┐     ┌───────────┐ ┌───────────┐   ┌────────────┐
        │  Redis   │     │ PostgreSQL│ │  MinIO/   │   │  Socket.io │
        │cache/bull│     │  (Prisma) │ │    S3     │   │  Gateway   │
        │limit/adap│     └───────────┘ └───────────┘   └────────────┘
        └──────────┘
                                 │ external integrations
              ┌──────────────────┼─────────────────┐
              ▼                  ▼                 ▼
       ┌────────────┐    ┌────────────┐    ┌────────────┐
       │  Midtrans/ │    │ RajaOngkir │    │   Email/   │
       │   Xendit   │    │  /Shipper  │    │   WA GW    │
       └────────────┘    └────────────┘    └────────────┘

   Async path (events/jobs):
   ┌────────────────────────────────────────────────┐
   │  apps/worker (BullMQ consumers)                │
   │  • image-processing  • notification  • email   │
   │  • payment-webhook   • shipment-sync • escrow  │
   └────────────────────────────────────────────────┘
```

### Service Breakdown

| Service | Tanggung jawab | Karakteristik |
|---|---|---|
| `apps/web` | UI buyer/seller (SSR) | Next.js App Router, edge-cacheable pages |
| `apps/api` | REST API, business logic, auth | Stateless, horizontal scale, HPA |
| `apps/socket` | Chat & notifikasi real-time | Long-lived connections, sticky session via Ingress |
| `apps/worker` | Background jobs (BullMQ) | Queue-driven, autoscale by queue depth (KEDA opsional) |
| `apps/admin` | Backoffice UI | Next.js terpisah, RBAC ketat |

---

## 3. Komunikasi Antar Komponen

| Komunikasi | Mekanisme |
|---|---|
| Web ↔ API | REST/JSON (HTTPS), JWT Bearer |
| Web ↔ Socket | WebSocket (Socket.io), JWT di handshake |
| API ↔ DB | Prisma (connection pooling via PgBouncer di prod) |
| API ↔ Redis | ioredis (cache, rate limit, distributed lock) |
| API ↔ Queue | BullMQ producer → Redis Streams |
| Worker ↔ External | HTTP webhook handler (payment, shipment) |
| Event internal | Outbox pattern → queue job (garanti konsistensi DB→queue) |

### Outbox Pattern
Transaksi yang men-trigger event (mis. `order.status_changed`) menulis row ke tabel `outbox_events` dalam transaction yang sama. Worker polling outbox → publish ke queue. Ini mencegah kehilangan event jika crash setelah DB commit tapi sebelum enqueue.

---

## 4. Data Model (Core)

```
users
  id uuid pk, email unique, phone unique, password_hash,
  full_name, avatar_url, role (BUYER|SELLER|ADMIN|SUPER_ADMIN),
  is_verified (e-KYC), trust_score int, status (ACTIVE|SUSPENDED),
  created_at, updated_at

verifications
  id, user_id fk, ktp_number_hash, selfie_url, status, reviewed_by, reviewed_at

addresses
  id, user_id fk, label, recipient_name, phone, province, city,
  district, postal_code, full_address, is_default

categories (tree via parent_id)
brands
catalog_products  -- katalog merek+model resmi (autocomplete listing)

listings
  id uuid pk, seller_id fk, category_id fk, brand_id fk, catalog_product_id fk,
  title, slug unique, description,
  condition (LIKE_NEW|FAIR|WORN|MINOR_DEFECT),
  usage_months int, warranty_remaining bool, accessories jsonb,
  price numeric, negotiable bool, status (DRAFT|ACTIVE|SOLD|INACTIVE),
  city, province, geo point opsional,
  created_at, updated_at
  indexes: (category_id, status, price), GIN tsvector(title, description)

listing_images
  id, listing_id fk, url, thumb_url, sort_order

offers (nego)
  id, listing_id fk, buyer_id fk, seller_id fk, offered_price,
  status (PENDING|ACCEPTED|REJECTED|COUNTERED|EXPIRED), counter_price, expires_at

carts / cart_items
  id, buyer_id fk; cart_items: cart_id fk, listing_id fk, offer_id fk nullable, seller snapshot

orders  -- satu order per seller (order group per checkout)
  id uuid pk, order_no unique (STX-2026-xxxx),
  buyer_id fk, seller_id fk,
  total_items_price, shipping_fee, escrow_fee, total_amount,
  status (PENDING_PAYMENT|FUNDED|SHIPPED|DELIVERED|INSPECTING|
          COMPLETED|DISPUTED|REFUNDED|CANCELLED),
  funding_deadline, inspection_deadline, auto_release_at,
  created_at, updated_at
  indexes: (buyer_id, status), (seller_id, status)

order_items
  id, order_id fk, listing_id fk, title snapshot, price snapshot, qty

payments
  id, order_id fk, provider (MIDTRANS|XENDIT), provider_ref,
  method, amount, status (PENDING|PAID|FAILED|EXPIRED|REFUNDED),
  paid_at, raw_payload jsonb, created_at

shipments
  id, order_id fk, courier, service, tracking_no, origin, destination,
  status history jsonb / tabel shipment_logs, est_delivery, cost

disputes
  id, order_id fk, opened_by fk, reason, description,
  status (OPEN|MEDIATION|RESOLVED_BUYER|RESOLVED_SELLER|CLOSED),
  resolution_note, resolved_by, resolved_at

dispute_evidences
  id, dispute_id fk, uploader_id fk, url, kind (PHOTO|VIDEO|TEXT)

reviews
  id, order_id fk unique, reviewer_id fk, target_user_id fk,
  rating 1-5, comment, image urls, seller_reply, created_at
  constraint: hanya 1 review per order, hanya jika order COMPLETED

conversations / messages
  conversation: id, listing_id fk nullable, buyer_id fk, seller_id fk,
                last_message_at, buyer_unread, seller_unread
  message: id, conversation_id fk, sender_id fk, type (TEXT|IMAGE|OFFER|SYSTEM),
           content, offer_id nullable, read_at

withdrawals
  id, user_id fk, amount, destination (bank/e-wallet), account_info,
  status (PENDING|PROCESSING|SUCCESS|FAILED), processed_at

wallets / wallet_transactions  -- saldo escrow seller
  wallet: user_id pk, balance, held_balance
  wallet_tx: id, wallet_id fk, type (ESCROW_RELEASE|WITHDRAW|ADJUSTMENT),
             amount, ref_type, ref_id, created_at

notifications
  id, user_id fk, type, title, body, data jsonb, read_at, created_at

outbox_events
  id, aggregate_type, aggregate_id, event_type, payload jsonb,
  processed_at, created_at

audit_logs
  id, actor_id, actor_role, action, entity, entity_id, metadata jsonb, ip, created_at
```

### Order State Machine (Inti Sistem)

```
PENDING_PAYMENT ──pay──▶ FUNDED ──seller kirim+resi──▶ SHIPPED
                                                        │
                                              kurir delivered
                                                        ▼
                                              DELIVERED ──buyer confirm / auto──▶ INSPECTING
                                                                                        │
                                                                            inspeksi OK (2×24 jam auto)
                                                                                        ▼
                                                                              COMPLETED → dana cair (ESCROW_RELEASE)

FUNDED ──batal sebelum kirim──▶ CANCELLED → refund otomatis
SHIPPED/DELIVERED/INSPECTING ──dispute──▶ DISPUTED ──mediasi──▶ COMPLETED | REFUNDED
```

Aturan penting:
- `FUNDED`: dana sudah masuk escrow (webhook `PAID` dari payment gateway — wajib verifikasi signature)
- Auto-cancel `PENDING_PAYMENT` via cron worker (mis. 24 jam)
- Auto-release `INSPECTING → COMPLETED` via cron worker (2×24 jam setelah delivered)
- Semua transisi status = satu transaction DB + outbox event + audit log
- **Idempotency key** wajib untuk webhook payment & mutation finansial

---

## 5. Skema API (Ringkas)

Base: `/api/v1` — Auth: `Authorization: Bearer <access_token>`

| Group | Endpoint utama |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/oauth/google` |
| Users | `GET/PATCH /users/me`, `GET /users/:id` (public profile + trust score), `POST /users/me/verification` |
| Addresses | CRUD `/users/me/addresses` |
| Listings | `GET /listings` (search+filter), `POST /listings`, `GET/PATCH/DELETE /listings/:id`, `POST /listings/:id/images` (presigned) |
| Offers | `POST /listings/:id/offers`, `PATCH /offers/:id` (accept/counter/reject) |
| Chat | `GET /conversations`, `GET /conversations/:id/messages`, `POST /conversations`, via WebSocket: `message:send`, `typing`, `read` |
| Cart | `GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:id` |
| Checkout | `POST /checkout` → validasi, kalkulasi ongkir+fee, buat order + payment |
| Payments | `POST /payments/webhook` (Midtrans/Xendit), `GET /payments/:id/status` |
| Orders | `GET /orders` (buyer/seller tab), `GET /orders/:id`, `POST /orders/:id/ship`, `POST /orders/:id/confirm-received`, `POST /orders/:id/cancel` |
| Shipments | `GET /shipping/rates`, `POST /shipments`, webhook status kurir |
| Disputes | `POST /orders/:id/disputes`, `POST /disputes/:id/evidences`, admin resolve |
| Reviews | `POST /orders/:id/review`, `GET /users/:id/reviews` |
| Wallet | `GET /wallet`, `POST /wallet/withdrawals` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read` |

OpenAPI spec lengkap: `apps/api/docs/openapi.yaml` (Swagger UI di `/api/docs`).

---

## 6. Real-time Design (Socket.io)

**Namespace**: `/chat` — auth via JWT di `handshake.auth.token`

| Event (client→server) | Deskripsi |
|---|---|
| `conversation:join` (room `conv:{id}`) | Join room setelah buka chat |
| `message:send` `{conversationId, type, content}` | Kirim pesan → server persist → emit `message:new` |
| `typing` `{conversationId}` | Emit `typing` ke lawan |
| `message:read` `{conversationId}` | Update read_at + unread count |
| `offer:send` / `offer:respond` | Nego via message type OFFER |

**Scaling**: Redis adapter (`@socket.io/redis-adapter`) agar multi-replica saling terhubung. Sticky session via Ingress `nginx.ingress.kubernetes.io/affinity: cookie` (fallback) atau Redis adapter saja.

**Fallback**: client long-polling (Socket.io default) jika WebSocket diblokir.

---

## 7. Infrastruktur & Deployment

### Local Dev
```bash
docker compose up -d   # postgres:15, redis:7, minio
pnpm dev               # web:3000 api:4000 socket:4001 admin:3001
```

### Production (K8s)

```
Namespaces: prod, staging
├── Deployments (replicas, HPA 2–10):
│   ├── api (2+)
│   ├── socket (2+)
│   ├── worker (2+)
│   └── web, admin (2+, atau static di CDN)
├── StatefulSet / managed:
│   ├── postgres (atau managed: RDS/Cloud SQL — direkomendasikan)
│   ├── redis (atau managed: ElastiCache/Memorystore)
│   └── minio (atau S3 managed)
├── Ingress: nginx-ingress + cert-manager (TLS auto)
├── Secrets: K8s Secrets (atau External Secrets + Vault)
├── Jobs/CronJobs: db-backup (harian), escrow auto-release, expired offers
└── Observability: Prometheus + Grafana + Loki, Sentry
```

### CI/CD (GitHub Actions)

```
PR ──▶ lint → typecheck → unit test → build
push main ──▶ + build docker images → push GHCR → deploy staging (helm upgrade)
tag v* ──▶ + approval gate → deploy prod → smoke test → rollback on failure
```

### Reliability
- **Backup DB**: WAL archiving + snapshot harian, retensi 30 hari, restore drill bulanan
- **Queue retry**: BullMQ exponential backoff, dead-letter queue + alert
- **Health checks**: `/healthz` (liveness), `/readyz` (readiness: cek DB & Redis)
- **Graceful shutdown**: stop accept → drain connections → tutup consumer queue
- **Disaster recovery**: RPO ≤ 1 jam, RTO ≤ 4 jam

---

## 8. Keamanan

| Area | Implementasi |
|---|---|
| AuthN | JWT access (15m, HS256/RS256) + refresh rotation di Redis (deteksi reuse → revoke semua) |
| AuthZ | RBAC guard di NestJS (`@Roles`), ownership check di service layer |
| Password | Argon2id |
| Input | class-validator (API) + Zod (frontend), sanitize HTML output |
| Rate limit | Redis token bucket: auth 5 req/menit, API umum 100 req/menit/IP, mutasi finansial lebih ketat |
| File upload | Presigned URL langsung ke S3/MinIO, validasi MIME + ukuran, scan AV (ClamAV worker, opsional) |
| Webhook | Verifikasi signature Midtrans/Xendit + idempotency key |
| PII | Enkripsi at-rest (pgcrypto / KMS), masking di log |
| Secret | K8s Secrets + External Secrets, **tidak pernah di git** |
| Supply chain | `pnpm audit` di CI, Trivy image scan |
| Audit | `audit_logs` untuk semua aksi admin & finansial |

---

## 9. Strategi Scaling (0 → 100K user)

| Trigger | Aksi |
|---|---|
| Baseline 10K | 2–3 replica API/socket, PostgreSQL single node + PgBouncer, Redis single |
| API CPU > 60% konsisten | HPA scale out, cache read-heavy endpoint (Redis), CDN untuk static & foto |
| Search lambat | Pindah full-text ke Elasticsearch/OpenSearch, CDC via outbox |
| DB bottleneck | Read replica untuk read-query, partitioning `orders` by range (per bulan), archivelah data lama |
| Socket > 10K koneksi/node | Scale socket replicas (Redis adapter), mis. 5K–10K conn/node |
| Worker backlog | KEDA autoscale by queue depth |
| Media cost | Lifecycle S3: foto >90 hari → cold storage; signed URL expiry pendek |

---

## 10. Keputusan Teknis Penting (ADR Ringkas)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Full-text search | PostgreSQL tsvector dulu | Cukup untuk 10K listing, nol infra tambahan; ES = phase scale |
| ORM | Prisma | Type-safe, migrasi robust, tim TS full-stack |
| Queue | BullMQ (Redis) | Sederhana, atomic, observability dashboard (`bull-board`) |
| Real-time | Socket.io + Redis adapter | Mature, fallback transport otomatis |
| Payment | Midtrans (primary), Xendit (backup-ready) | Coverage metode ID (VA, QRIS, e-wallet), escrow-compatible flow |
| Foto storage | Presigned direct upload | API tidak jadi bottleneck bandwidth |
| Deploy | Docker + K8s sesuai requirement, managed DB direkomendasikan di prod | Self-managed K8s OK, DB managed mengurangi risiko |

---

> Dokumen ini hidup — update bersamaan dengan perubahan arsitektur. ADR detail disimpan di `docs/adr/`.
