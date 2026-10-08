# Release Notes (Pre-Merge): feat/wallet-pin to main

This document summarizes the architectural, security, and financial changes introduced on branch `feat/wallet-pin` before merging into `main`.

---

## 1. Risk-Grouped Changes

### Security
- **TOTP Encryption & Plaintext Secret Elimination**: Dropped legacy plaintext TOTP secret columns. All TOTP secrets are encrypted at rest using AES-256-GCM with PBKDF2/scrypt derived keys.
- **Persistent TOTP Timestep Replay Defense**: Persistent database tracking of used timesteps prevents replay attacks across distributed instances and restarts.
- **Server-Authoritative Session Revocation**: Database-backed `sessionVersion` and `accountStatus` guarantees immediate revocation of active signed cookies upon role change, password reset, or admin action.
- **Server-Authoritative Wallet Read Model**: Client-side wallet cache abolished. Wallet balance and transactions are computed strictly from append-only ledger records (`GET /api/wallet`).
- **Payout Destination Integrity & IDOR Defense**: Withdrawals enforce canonical `bankAccountId` ownership verified directly against the user profile. Foreign account injections are rejected.
- **Transaction PIN Lifecycle**: Mandatory bcrypt transaction PIN for financial actions, weak PIN blacklist (e.g. `123456`, `111111`), set-once policy (`PIN_ALREADY_SET`), and fail-closed lockout counter (`pinFailedAttempts`).
- **D6 Security Risk Acknowledgment**: Documented shared lockout counter (`pinFailedAttempts`) between set-PIN password verification and withdrawal attempts in `docs/engineering/SECURITY.md` Section 10.5 (to be separated before production launch with real capital).
- **D4 Demo Simulation Gating**: `POST /api/orders/[id]/simulate` is gated by `DEMO_PAYMENT_PROVIDER` and returns 404 in production (`APP_ENV=production`). Access requires order participant session (buyer, seller, or admin); third parties receive 403 `FORBIDDEN`.
- **Legacy Express App Removal**: Deleted unmaintained and unauthenticated `apps/api` service.

### Money & Financial Invariants
- **Atomic Listing Reservation (`POST /api/orders`)**: Replaced non-atomic availability checks with in-transaction CAS `tx.productListing.updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'RESERVED' } })`. Concurrent orders for the same listing result in exactly 1 success (`201`) and `422 LISTING_NOT_ACTIVE` for all others.
- **CAS Lazy Expiry for Reservations**: When encountering an expired `PENDING_PAYMENT` order blocking a listing, the stale order is cancelled atomically via CAS, stale `PaymentAttempt` records marked `EXPIRED`, and the reservation transferred to the incoming buyer without `ACTIVE` flicker.
- **Late Payment Rejection**: Simulated payment webhooks targeting cancelled or expired orders are rejected with 422 `PAYMENT_REJECTED` and create zero new ledger or escrow entries.
- **D8 Expand-Only Partial Unique Index**: Hand-written PostgreSQL index `order_single_active_listing_idx` on `Order("listingId")` where status is not terminal (`CANCELLED`, `REFUNDED`, `COMPLETED`), guaranteeing database-level active order uniqueness per listing.
- **D7 Refund Listing Lifecycle**: Upon `REFUND_BUYER`, listing transitions to `ARCHIVED` (non-buyable). Subsequent order creation attempts return 422 `LISTING_NOT_ACTIVE`.
- **Append-Only Financial Ledger**: Escrow holds, releases, dispute payouts, and seller withdrawals are balanced and recorded via paired double-entry ledger rows.

### UX Copy & Client UI
- **Server-Authoritative Price**: Checkout displays and charges the server-persisted listing price. Client-submitted prices are strictly ignored and validated against the database.
- **Disabled Negotiated Checkout**: Custom offer checkout is disabled until server-authoritative offer contracts are introduced.
- **Conditional Simulation Controls**: The simulation panel on `/orders/[id]` is rendered only when `order.isSimulationAllowed` is true (hydrated from `GET /api/orders/[id]`). The panel is omitted in production or when simulation providers are disabled. Zero secrets are exposed to client JavaScript.

---

## 2. Database Migrations List

1. `20260912083315_pass_3_security_hardening`
   - Added `sessionVersion`, `accountStatus`, encrypted TOTP secret fields, and `TotpUsedTimestep` replay prevention table.
2. `20260913020000_drop_plaintext_totp_secret`
   - Dropped legacy unencrypted `totpSecret` column from `User` table.
3. `20261008180000_partial_unique_index_active_order`
   - Added hand-written expand-only partial unique index `order_single_active_listing_idx` on `Order("listingId") WHERE status NOT IN ('CANCELLED', 'REFUNDED', 'COMPLETED')`.

---

## 3. Required Pre-Deployment Scripts (Owner Actions)

Before running `prisma migrate deploy` on any shared or persistent database, the repository owner must execute the following scripts in order:

### 1. Active Order Duplicates Pre-Flight Check (D8)
Inspects the database for existing multiple active orders on the same listing prior to applying the partial unique index:
```bash
pnpm --filter web run db:check-active-order-duplicates
```
*Requirement: Must exit with code 0 (zero duplicates) before applying migration.*

### 2. Default PIN Migration & Verification
Backfills and verifies default PIN hashes for existing demo users:
```bash
# Dry run inspection:
pnpm --filter web run db:migrate-default-pins -- --dry-run

# Apply migration:
pnpm --filter web run db:migrate-default-pins -- --apply

# Verify migration integrity:
pnpm --filter web run db:verify-default-pins
```

### 3. Order Idempotency Scrubbing & Verification
Scrubs legacy raw order idempotency records:
```bash
# Dry run inspection:
pnpm --filter web run db:scrub-order-idempotency -- --dry-run

# Apply scrubbing:
pnpm --filter web run db:scrub-order-idempotency -- --apply

# Verify scrubbing integrity:
pnpm --filter web run db:verify-scrub-order-idempotency
```

---

## 4. Credential Rotation Notice

> [!WARNING]
> Any user credentials, transaction PINs, or TOTP keys used in environments running builds prior to commit `efc0440` (introduction of server-authoritative order flow and secret-leak hardening) must be rotated immediately upon deployment.

---

## 5. Known Limitations

1. **Decision D7 (Archived Listings After Refund)**: After `REFUND_BUYER`, a listing transitions to `ARCHIVED` (non-buyable). No seller relist route currently exists. Relisting capability will be introduced in a future release.
2. **Offer / Negotiation Checkout**: Custom offer negotiations remain in simulated client mode and are not yet connected to the authoritative checkout endpoint.
