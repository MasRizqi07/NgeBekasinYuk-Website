# NgeBekasinYuk (Website)
### C2C Secondhand Tech Marketplace with Escrow (Rekening Bersama)

[![Verification CI](https://github.com/MasRizqi07/NgeBekasinYuk-Website/actions/workflows/ci.yml/badge.svg)](https://github.com/MasRizqi07/NgeBekasinYuk-Website/actions)
![Maturity](https://img.shields.io/badge/Maturity-Production_Candidate-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict_5.x-green)
![Next.js](https://img.shields.io/badge/Next.js-16.3.4_App_Router-black)
![Database](https://img.shields.io/badge/Prisma_ORM-6.4.1-indigo)
![Tests](https://img.shields.io/badge/Vitest-47_Passed_100%25-success)

---

## 1. Overview & Identity

**NgeBekasinYuk** is a specialized C2C marketplace designed for buying and selling secondhand gadgets and technology products (smartphones, laptops, gaming consoles, audio gear, and cameras).

### Core Product Differentiators:
- **Escrow / Rekening Bersama**: Buyer funds are locked securely until delivery and inspection are confirmed.
- **Buyer 2x24-Hour Inspection Period**: A countdown timer starts when the courier delivers the package, during which the buyer tests device condition.
- **Integrated Price Negotiation**: Interactive offer system with real-time chat.
- **Seller Trust & Verification**: Verified seller profiles, condition grading (`LIKE_NEW`, `VERY_GOOD`, `FAIR`), and fraud notices.
- **Seller Wallet & Withdrawal**: Double-entry ledger with server-side PIN authentication and BI-FAST simulation.
- **Tri-Party Dispute Mediation**: Dedicated dispute resolution room with admin step-up verification and atomic escrow verdicts.

---

## 2. Architecture & Tech Stack

```text
Frontend Framework : Next.js 16.3.4 (App Router, React 19, TypeScript 5.x)
Styling            : Tailwind CSS v4, Framer Motion, Lucide React
State Management   : Zustand 5.x (Client UI, optimistic interactions)
Data Persistence   : Prisma ORM 6.4.1 (SQLite for local dev, PostgreSQL for production)
Validation         : Zod
Security & Auth    : HMAC-SHA256 Signed HttpOnly Session Cookies, Bcrypt Password & PIN Hashing
Test Runner        : Vitest v4.1.x (47 unit and integration tests)
```

---

## 3. Getting Started (Local Development)

### Prerequisites:
- Node.js >= 20.x
- pnpm >= 9.x

### Step-by-Step Setup:

1. **Clone and Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Setup Environment Variables**:
   Copy `.env.example` in `apps/web`:
   ```bash
   cp apps/web/.env.example apps/web/.env
   ```

3. **Initialize Database Schema & Client**:
   ```bash
   pnpm --filter web exec prisma generate
   pnpm --filter web exec prisma db push
   ```

4. **Seed Deterministic Data**:
   ```bash
   pnpm --filter web run db:seed
   ```

5. **Start Development Server**:
   ```bash
   pnpm --filter web dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Demo Accounts & Credentials

The seed script creates three default development roles:

| Role | Email | Password | Transaction PIN | Purpose |
|---|---|---|---|---|
| **Buyer** | `buyer@ngebekasinyuk.id` | `Password123!` | `123456` | Browse, negotiate, checkout, inspect unit, confirm receipt, or dispute |
| **Seller** | `seller@ngebekasinyuk.id` | `Password123!` | `123456` | List products, accept offers, ship orders, withdraw wallet balance |
| **Admin** | `admin@ngebekasinyuk.id` | `AdminSecret2026!` | N/A (2FA: `882910`) | Access `/admin/dashboard`, review disputes, execute escrow verdicts |

---

## 5. Verification Commands

Run the full suite of verification commands:

```bash
# 1. Run ESLint (0 errors)
pnpm --filter web run lint

# 2. Strict TypeScript Typecheck (0 errors)
pnpm --filter web run typecheck

# 3. Automated Unit & Integration Tests (47 passing tests)
pnpm --filter web run test

# 4. Production App Router Build (26 routes generated)
pnpm --filter web run build
```

---

## 6. Engineering Documentation

Detailed technical design specifications are available in `docs/engineering/`:
- [`ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md) - System architecture and server authority boundaries
- [`DATA_MODEL.md`](docs/engineering/DATA_MODEL.md) - Normalized relational schema and constraints
- [`ORDER_STATE_MACHINE.md`](docs/engineering/ORDER_STATE_MACHINE.md) - Formal order lifecycle matrix and invariants
- [`ESCROW_LEDGER.md`](docs/engineering/ESCROW_LEDGER.md) - Double-entry ledger and idempotency model
- [`AUTHORIZATION_MATRIX.md`](docs/engineering/AUTHORIZATION_MATRIX.md) - Server-enforced RBAC and resource ownership
- [`SECURITY.md`](docs/engineering/SECURITY.md) - Application security audit and OWASP defenses
- [`TEST_STRATEGY.md`](docs/engineering/TEST_STRATEGY.md) - Test suites, coverage, and execution
- [`DEPLOYMENT.md`](docs/engineering/DEPLOYMENT.md) - Docker staging and production runbook
- [`FINAL_AUDIT.md`](docs/engineering/FINAL_AUDIT.md) - Complete forensic audit and release readiness assessment
