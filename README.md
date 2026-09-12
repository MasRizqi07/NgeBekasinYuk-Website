# NgeBekasinYuk (Website)
### C2C Secondhand Tech Marketplace with Escrow (Rekening Bersama)

[![Verification CI](https://github.com/MasRizqi07/NgeBekasinYuk-Website/actions/workflows/ci.yml/badge.svg)](https://github.com/MasRizqi07/NgeBekasinYuk-Website/actions)
![Maturity](https://img.shields.io/badge/Maturity-Production_Candidate-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict_5.x-green)
![Next.js](https://img.shields.io/badge/Next.js-16.3.4_App_Router-black)
![Database](https://img.shields.io/badge/Prisma_ORM-6.4.1_PostgreSQL-indigo)
![Tests](https://img.shields.io/badge/Vitest-108_Passed_100%25-success)
![E2E](https://img.shields.io/badge/Playwright-16_Passed_100%25-success)
![ESLint](https://img.shields.io/badge/ESLint-0_Errors_0_Warnings-brightgreen)

---

## 1. Overview & Identity

**NgeBekasinYuk** is a specialized C2C marketplace designed for buying and selling secondhand gadgets and technology products (smartphones, laptops, gaming consoles, audio gear, and cameras).

### Core Product Differentiators:
- **Escrow / Rekening Bersama**: Buyer funds are locked securely until delivery and inspection are confirmed.
- **Buyer 2x24-Hour Inspection Period**: A countdown timer starts when the courier delivers the package, during which the buyer tests device condition.
- **Integrated Price Negotiation**: Interactive offer system with real-time chat.
- **Seller Trust & Verification**: Verified seller profiles, condition grading (`LIKE_NEW`, `VERY_GOOD`, `FAIR`), and fraud notices.
- **Seller Wallet & Withdrawal**: Append-only wallet ledger with paired financial records, server-side PIN authentication, conditional concurrency locking, and BI-FAST simulation.
- **Tri-Party Dispute Mediation**: Dedicated dispute resolution room with real RFC 6238 TOTP admin step-up verification, AES-256-GCM encrypted secrets, single-use resource-scoped step-up grants, and atomic escrow verdicts.
- **Database-Authoritative Session Revocation**: Database-enforced `sessionVersion` and `accountStatus` guarantees immediate privilege revocation upon password resets, role downgrades, or administrative disablement.
- **Distributed TOTP Replay Defense**: Persistent PostgreSQL-backed RFC 6238 timestep tracking resilient across server instances and restarts.

---

## 2. Architecture & Tech Stack

```text
Frontend Framework : Next.js 16.3.4 (App Router, React 19, TypeScript 5.x)
Routing Guard      : Next.js Proxy convention (src/proxy.ts, zero deprecation warnings)
Styling            : Tailwind CSS v4, Framer Motion, Lucide React
State Management   : Zustand 5.x (Client UI, optimistic interactions)
Data Persistence   : Prisma ORM 6.4.1 (PostgreSQL 16+ with forward migrations)
Validation         : Zod schemas for all mutating endpoints, fail-closed runtime env
Security & Auth    : Web Crypto HMAC-SHA256 Signed HttpOnly Session Cookies, Bcrypt Password & PIN,
                     Database-Authoritative Session Revocation, AES-256-GCM Encrypted TOTP Secrets,
                     Persistent PostgreSQL-backed TOTP Replay Defense, Single-Use Step-Up Grants
Test Runners       : Vitest v4.1.x (108 unit, integration & concurrency tests across 16 suites),
                     Playwright v1.50+ (16 browser & security regression E2E tests)
Quality Gate       : ESLint (0 errors, 0 warnings), Strict TypeScript (0 errors)
```

---

## 3. Getting Started (Local Development)

### Prerequisites:
- Node.js >= 20.x
- pnpm >= 9.x
- PostgreSQL 16+ (Docker or local instance)

### Step-by-Step Setup:

1. **Clone and Install Dependencies**:
   ```bash
   pnpm install --frozen-lockfile
   ```

2. **Setup Environment Variables**:
   Copy `.env.example` to `.env` and `apps/web/.env`:
   ```bash
   cp apps/web/.env.example apps/web/.env
   ```

3. **Deploy Migrations & Generate Prisma Client**:
   ```bash
   pnpm --filter web exec prisma migrate deploy
   pnpm --filter web run prisma:generate
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

The seed script creates deterministic development test fixtures:

| Role | Email | Password | Transaction PIN | 2FA / TOTP | Purpose |
|---|---|---|---|---|---|
| **Buyer** | `buyer@ngebekasinyuk.id` | `Password123!` | `123456` | N/A | Browse, negotiate, checkout, inspect unit, confirm receipt, or dispute |
| **Seller** | `seller@ngebekasinyuk.id` | `Password123!` | `123456` | N/A | List products, accept offers, ship orders, withdraw wallet balance |
| **Admin** | `admin@ngebekasinyuk.id` | `AdminSecret2026!` | N/A | RFC 6238 TOTP (`JBSWY3DPEHPK3PXP`) | Access `/admin/dashboard`, review disputes, execute escrow verdicts |
| **Admin (Sarah)** | `admin.sarah@ngebekasinyuk.id` | `AdminSecret2026!` | N/A | RFC 6238 TOTP (`JBSWY3DPEHPK3PXP`) | Secondary admin fixture for independent verdict testing |

---

## 5. Verification Commands

Run the full suite of verification commands:

```bash
# 1. Code Quality & Strict Linting (0 errors, 0 warnings)
pnpm run lint

# 2. Strict TypeScript Typecheck (0 errors)
pnpm --filter web run typecheck

# 3. Unit, Integration & Concurrency Test Suite (108 passing tests)
pnpm --filter web run test

# 4. Production App Router Build (27 routes generated, 0 warnings)
pnpm --filter web run build

# 5. Playwright Browser E2E Test Suite (16 passing tests)
pnpm --filter web run test:e2e
```

---

## 6. Engineering Documentation

Detailed technical design specifications are available in `docs/engineering/`:
- [`HARDENING_PASS_3_FINAL_CERTIFICATION.md`](docs/engineering/HARDENING_PASS_3_FINAL_CERTIFICATION.md) - **Hardening Pass #3 Final Production Candidate Certification Report**
- [`HARDENING_PASS_2.md`](docs/engineering/HARDENING_PASS_2.md) - Hardening Pass #2 forensic audit report & gate evidence
- [`ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md) - System architecture and server authority boundaries
- [`DATA_MODEL.md`](docs/engineering/DATA_MODEL.md) - Normalized relational schema, indexes, and constraints
- [`ORDER_STATE_MACHINE.md`](docs/engineering/ORDER_STATE_MACHINE.md) - Formal order lifecycle matrix and invariants
- [`ESCROW_LEDGER.md`](docs/engineering/ESCROW_LEDGER.md) - Append-only escrow & wallet ledger with paired financial records
- [`AUTHORIZATION_MATRIX.md`](docs/engineering/AUTHORIZATION_MATRIX.md) - Server-enforced RBAC, signed middleware verification, and resource ownership
- [`SECURITY.md`](docs/engineering/SECURITY.md) - Application security audit, RFC 6238 TOTP step-up, and OWASP defenses
- [`TEST_STRATEGY.md`](docs/engineering/TEST_STRATEGY.md) - Test suites, concurrency testing, and Playwright E2E execution
- [`DEPLOYMENT.md`](docs/engineering/DEPLOYMENT.md) - PostgreSQL migration strategy, Docker staging, and production runbook
- [`FINAL_AUDIT.md`](docs/engineering/FINAL_AUDIT.md) - Complete forensic audit and release readiness assessment
