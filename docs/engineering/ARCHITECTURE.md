# NgeBekasinYuk Architecture & System Design

## 1. Architectural Philosophy

NgeBekasinYuk is a Consumer-to-Consumer (C2C) secondhand technology marketplace with integrated Escrow (Rekening Bersama), price negotiation, a 2x24-hour buyer inspection window, and seller wallet withdrawals.

Prior to hardening, the prototype relied heavily on client-side state persisted in browser `localStorage` via Zustand. While visually interactive, sensitive financial actions (escrow releases, refunds, order transitions) were executing client-side without server validation or database transactions.

The hardened architecture shifts from **client-side simulation** to **server-authoritative, relational database-backed, audit-logged architecture**.

```text
Browser (Next.js Client Components)
   ↓  HTTP / JSON (Cookies: SameSite=Lax, HttpOnly)
Next.js Middleware (Route Guard & Security Headers)
   ↓
App Router Route Handlers & Server Actions
   ↓  Zod Schema Validation
Domain Layer (OrderStateMachine, EscrowLedgerService, WalletLedgerService, DisputeService)
   ↓  ACID Database Transactions
Prisma ORM (PostgreSQL in Production / SQLite in Zero-Dependency Local Dev)
   ↓  Double-Entry Append-Only Records
AuditLog & Immutable Ledgers (EscrowLedgerEntry, WalletLedgerEntry)
```

---

## 2. Server Authority vs. Client State

| Responsibility | Authoritative Source | Client Role (Zustand / React) |
|---|---|---|
| Order Status & History | PostgreSQL / Prisma | Optimistic UI, timeline rendering |
| Escrow Balance & State | `EscrowAccount` & `EscrowLedgerEntry` | Read-only presentation, countdown timer |
| Seller Wallet Balance | `WalletLedgerEntry` & `Wallet` | Read-only balance cards |
| Withdrawals | `Withdrawal` & `WalletLedgerEntry` | Form inputs, status feedback |
| Dispute Decisions | `Dispute` & Admin Audit Logs | Tri-party chat interface, status badge |
| Transaction PIN | Bcrypt hash in `User.hashedPin` | PIN dots animation, numeric input |
| Ephemeral UI Concerns | Client React State | Modals, tabs, filter drawers, confetti |

---

## 3. Core Domain Subsystems

### 3.1 Order Lifecycle Subsystem (`src/domain/order/`)
- Formal state machine (`OrderStateMachine.ts`) enforcing:
  - `PENDING_PAYMENT` -> `FUNDED` -> `PROCESSING` -> `SHIPPED` -> `DELIVERED` -> `INSPECTING` -> `COMPLETED` / `DISPUTED`
- Enforces actor role permissions (`BUYER`, `SELLER`, `ADMIN`, `SYSTEM`).
- Prevents skipping stages or mutating terminal states (`COMPLETED`, `REFUNDED`, `CANCELLED`).

### 3.2 Escrow Ledger Subsystem (`src/domain/escrow/`)
- Server-authoritative double-entry ledger:
  - `DEPOSIT`: Buyer payment credited.
  - `HOLD`: Escrow funds held during shipment and inspection.
  - `RELEASE_SELLER`: Escrow funds credited to seller wallet.
  - `REFUND_BUYER`: Escrow funds returned to buyer.
- Invariants:
  - Idempotency key per release/refund prevents double payouts (`P0-03`).
  - Mutual exclusion: An escrow account cannot be both released and refunded.
  - Dispute freeze: Active disputes freeze escrow releases until authorized admin verdict.

### 3.3 Wallet & Withdrawal Subsystem (`src/domain/wallet/`)
- Server-side bcrypt PIN verification (`P0-04`).
- Rate limiting and temporary lockout (5 failed attempts trigger 15-minute lock).
- Double-entry withdrawal deduction with atomic transaction.
- Explicit labeling: Marked honestly as `isSimulation: true` ("Simulasi BI-FAST").

### 3.4 Dispute Mediation Subsystem (`src/domain/dispute/`)
- Persisted dispute tickets with evidence uploads and tri-party chat messages.
- Atomic admin resolution (`DisputeService.resolveDispute`):
  - Unfreezes escrow and executes release or refund in a single database transaction.
  - Admin step-up 2FA verification (`P0-05`).
  - Records append-only security audit log (`AuditLog`).

---

## 4. Payment Gateway Abstraction (`src/domain/payment/`)

The application decouples payment gateway logic from business rules via the `PaymentProvider` interface:
```typescript
interface PaymentProvider {
  createPayment(params: CreatePaymentParams): Promise<PaymentAttemptResponse>;
  simulateWebhook(params: WebhookParams): Promise<WebhookResult>;
}
```
In local development, `DemoPaymentProvider` generates deterministic Virtual Account numbers (BCA, Mandiri, BRI, BNI) and QRIS payload strings. Webhook simulations validate server-side expiration timestamps and idempotently fund escrows without requiring production credentials.
