# NgeBekasinYuk Architecture & System Design
### Hardening Pass #3 Production Candidate System Architecture

## 1. Architectural Overview & Trust Boundaries

NgeBekasinYuk is a Consumer-to-Consumer (C2C) secondhand technology marketplace with integrated Escrow (Rekening Bersama), price negotiation, a 2x24-hour buyer inspection window, and seller wallet disbursements.

Following **Hardening Pass #3**, the application enforces dual-layer session verification, framework-native proxy routing, persistent distributed TOTP replay defense, application-layer secret encryption-at-rest, and single-use step-up authorization grants:

```text
Browser (Next.js Client Components)
   ↓  HTTP / JSON (Cookies: SameSite=Lax, HttpOnly, Signed HMAC-SHA256)
Next.js Proxy (src/proxy.ts)
   ↓  Coarse Edge Gate: Verifies cryptographic HMAC-SHA256 signature, route roles, and applies CSP headers
High-Risk API Route Handlers (/api/*)
   ↓  Layer 2 Gate: Authoritative Database Session & Account Status Validation (validateAuthoritativeSession)
      - Compares token.sessionVersion === dbUser.sessionVersion (immediate revocation)
      - Enforces dbUser.accountStatus === "ACTIVE"
      - Enforces authoritative dbUser.role
   ↓  Zod Schema Validation & Object-Level Ownership Checks
Domain Services (OrderStateMachine, EscrowLedgerService, WalletLedgerService, DisputeService)
   ↓  Database-Native Conditional Atomic Transactions (PostgreSQL 16+)
   ↓  Single-Use Step-Up Grant Consumption (AdminStepUpGrant.updateMany WHERE consumedAt IS NULL)
   ↓  Distributed TOTP Replay Prevention (User.updateMany WHERE lastTotpStep < step)
Prisma ORM (Versioned Forward Migrations via prisma/migrations/*)
   ↓  Append-Only Paired Financial Records & Encrypted Sensitive Credentials (AES-256-GCM)
PostgreSQL Database (EscrowLedgerEntry, WalletLedgerEntry, AuditLog, AdminStepUpGrant)
```

---

## 2. Server Authority vs. Client State

| Responsibility | Authoritative Source | Client Role (Zustand / React) |
|---|---|---|
| Session Authentication | Web Crypto HMAC-SHA256 Signed Cookies | Session context store, UI header avatar |
| Authoritative Privilege | PostgreSQL `User.sessionVersion`, `accountStatus`, `role` | Read-only session state from `/api/auth/session` |
| Order Status & History | PostgreSQL 16+ / Prisma ORM | Optimistic UI, timeline rendering |
| Escrow Balance & State | `EscrowAccount` & `EscrowLedgerEntry` | Read-only presentation, inspection countdown |
| Seller Wallet Balance | `WalletLedgerEntry` & `Wallet` | Read-only balance cards |
| Withdrawals | `Withdrawal` & `WalletLedgerEntry` | Form inputs, status feedback |
| Admin Dispute Decisions | `Dispute` & Admin Audit Logs | Tri-party chat interface, status badge |
| Admin 2FA Step-Up | RFC 6238 TOTP, AES-256-GCM, One-Time Grants | 6-digit authenticator prompt modal |
| Transaction PIN | Bcrypt hash in `User.hashedPin` | PIN dots animation, numeric keypad |
| Ephemeral UI Concerns | Client React State | Modals, tabs, filter drawers, confetti |

---

## 3. Core Domain Subsystems

### 3.1 Order Lifecycle Subsystem (`src/domain/order/`)
- Formal state machine (`OrderStateMachine.ts`) enforcing:
  - `PENDING_PAYMENT` -> `FUNDED` -> `PROCESSING` -> `SHIPPED` -> `DELIVERED` -> `INSPECTING` -> `COMPLETED` / `DISPUTED`
- Enforces actor role permissions (`BUYER`, `SELLER`, `ADMIN`, `SYSTEM`).
- Prevents skipping stages or mutating terminal states (`COMPLETED`, `REFUNDED`, `CANCELLED`).
- Lazy inspection expiry evaluation ensures orders transition cleanly even in the absence of external cron daemons.

### 3.2 Escrow Ledger Subsystem (`src/domain/escrow/`)
- Server-authoritative append-only paired ledger records:
  - `DEPOSIT`: Buyer payment credited to escrow hold.
  - `HOLD`: Escrow funds held during shipment and inspection.
  - `RELEASE_SELLER`: Escrow funds credited to seller wallet.
  - `REFUND_BUYER`: Escrow funds returned to buyer.
- Concurrency & Invariant Enforcement (`HP2-P0-04`):
  - In-transaction conditional atomic update (`where: { id, isReleased: false, isRefunded: false }`).
  - Guaranteed mutual exclusion: An escrow account can never be both released and refunded.
  - Dispute freeze: Active disputes freeze escrow releases until authorized admin verdict.

### 3.3 Wallet & Withdrawal Subsystem (`src/domain/wallet/`)
- Server-side bcrypt PIN verification with rate limiting (5 failed attempts trigger 15-minute lock).
- Concurrency & Lost Update Protection (`HP2-P0-05`):
  - In-transaction conditional balance decrement (`where: { activeBalance: { gte: amount } }`).
  - Scoped request UUID idempotency keys prevent replay while allowing legitimate future withdrawals.
- Transparent labeling: Marked honestly as `isSimulation: true` ("Simulasi BI-FAST").

### 3.4 Dispute Mediation Subsystem (`src/domain/dispute/`)
- Persisted dispute tickets with evidence uploads and tri-party chat messages.
- Atomic admin resolution (`DisputeService.resolveDispute`):
  - Unfreezes escrow and executes release or refund in a single atomic database transaction.
  - Requires single-use, resource-bound step-up grant (`AdminStepUpGrant`) verified and consumed in PostgreSQL (`HP3-P0-04`).
  - Records append-only security audit log (`AuditLog`).

---

## 4. Payment Gateway & Environment Abstraction (`src/domain/payment/`)

The application decouples payment gateway logic from business rules via the `PaymentProvider` interface:
```typescript
interface PaymentProvider {
  createPayment(params: CreatePaymentParams): Promise<PaymentAttemptResponse>;
  simulateWebhook(params: WebhookParams): Promise<WebhookResult>;
}
```
In local development, `DemoPaymentProvider` generates deterministic Virtual Account numbers and QRIS payload strings.
In production (`APP_ENV=production`), all demo simulation providers are strictly forbidden at startup, and simulator endpoints (`/api/payment/simulate-webhook`) return `404 Not Found`.
