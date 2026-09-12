# NgeBekasinYuk — Baseline Forensic Audit Report

**Date**: September 11, 2026  
**Auditor**: Principal Software Engineer & Application Security Architect  
**Codebase**: `MasRizqi07/NgeBekasinYuk-Website`  
**Target**: `apps/web` (Next.js App Router Marketplace Application)  
**Status**: COMPLETED (Baseline captured before hardening)

---

## 1. Executive Summary

This forensic audit evaluates the technical architecture, security posture, data integrity, and compliance of the NgeBekasinYuk codebase. 

Prior to this hardening engagement, the application functioned as a high-fidelity visual and interactive prototype. However, its business domain logic—specifically financial operations, escrow fund releases, order state transitions, wallet accounting, dispute verdicts, and role authorization—relied almost entirely on client-side state stored in `localStorage` through Zustand.

Critical vulnerabilities identified include:
1. **Client-Side Financial Authority**: Orders can be marked as funded or released to seller wallets entirely within the user's browser with zero server validation.
2. **Double-Spending & Replay Exposure**: Escrow release operations lack database-level unique constraints and idempotency keys, allowing duplicate releases.
3. **Broken Wallet PIN Validation**: A logic bug in PIN verification (`pin !== "123456" && pin.length !== 6`) inadvertently permits any 6-digit PIN.
4. **Mock Administrative Controls**: Admin dispute verdicts and 2FA TOTP codes are hardcoded mock values running on the client without session authentication or server-side RBAC.
5. **Misleading Regulatory Claims**: UI components reference integration with "OJK Audit Log" and live "BI-FAST" networks that do not exist.

---

## 2. Workspace & Environment Baseline

### 2.1 Repository Structure
```text
NgeBekasinYuk-Web/
├── apps/
│   ├── api/                 # Starter NestJS service (minimal starter files)
│   └── web/                 # Primary Next.js App Router application (20 routes)
├── packages/
│   └── config/              # Shared ESLint and TypeScript configs
├── docker-compose.yml       # Postgres 15, Redis 7, MinIO service specifications
├── pnpm-workspace.yaml      # Monorepo configuration
├── turbo.json               # Turborepo task pipeline
└── docs/                    # Architectural and project documentation
```

### 2.2 Framework & Dependency Versions
- **Next.js**: `16.3.4` (App Router, Turbopack)
- **React**: `19.2.8` (React DOM `19.2.8`)
- **TypeScript**: `5.x` (`strict: true`)
- **Tailwind CSS**: `4.x` (with `@tailwindcss/postcss`)
- **State Management**: Zustand `5.0.15` with `persist` middleware
- **Animations**: Framer Motion `13.2.0`
- **Package Manager**: `pnpm 9.0.0`

### 2.3 Baseline Command Results

| Command | Working Directory | Exit Code | Duration | Outcome / Output Summary |
| :--- | :--- | :---: | :---: | :--- |
| `pnpm install` | Repo Root | `0` | 3.6s | Lockfile up to date, 3 workspace projects resolved cleanly. |
| `pnpm --filter web lint` | `apps/web` | `1` | 4.2s | **FAILED**: 110 problems (12 errors, 98 warnings). Unescaped quotes, explicit `any`, missing hook dependencies. |
| `pnpm --filter web build` | `apps/web` | `0` | 4.5s | **PASSED**: Compiled successfully, all 20 static and dynamic routes generated. |
| `npx tsc --noEmit` | `apps/web` | `0` | 2.9s | **PASSED**: Zero TypeScript compile-time errors. |

---

## 3. Comprehensive Finding Table

| ID | Severity | Area | Affected File(s) | Description | Impact | Evidence / Snippet | Recommended Fix | Status |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **P0-01** | **P0** | Escrow Authority | `apps/web/src/stores/useOrderStore.ts` | Order lifecycle transitions (`payOrder`, `confirmOrderReceived`) mutate browser `localStorage`. | Any user can bypass payment and release funds by executing JavaScript in DevTools. | `payOrder: (id) => set({ orders: ... status: 'FUNDED' })` | Move authoritative order transitions to server actions / route handlers backed by relational DB. | **PENDING** |
| **P0-02** | **P0** | State Machine | `apps/web/src/stores/useOrderStore.ts` | Transitions do not validate current order status or actor role. | A cancelled or disputed order can be forced into `FUNDED` or `COMPLETED`. | No status check inside `payOrder` or `confirmOrderReceived`. | Implement centralized `OrderStateMachine` with strict transition guards. | **PENDING** |
| **P0-03** | **P0** | Idempotency | `apps/web/src/stores/useOrderStore.ts`, `useWalletStore.ts` | No idempotency keys or unique constraints on escrow releases. | Rapid clicks or replay requests credit seller wallet multiple times for one order. | `useWalletStore.getState().releaseEscrowToWallet(order.itemPrice, order.id, ...)` called directly on every button click. | Add `idempotencyKey` and database unique constraints inside an ACID transaction. | **PENDING** |
| **P0-04** | **P0** | Wallet PIN | `apps/web/src/stores/useWalletStore.ts` | Flawed conditional logic: `if (pin !== "123456" && pin.length !== 6)`. | Any arbitrary 6-digit PIN is accepted because `pin.length !== 6` evaluates to false. | `if (pin !== "123456" && pin.length !== 6) return { success: false }` | Fix conditional logic; migrate to server-side bcrypt-hashed PIN with attempt lockout. | **PENDING** |
| **P0-05** | **P0** | Admin 2FA | `apps/web/src/app/(admin)/admin/disputes/page.tsx` | Admin verdict modal displays hardcoded TOTP digits and executes resolution on client without validation. | Completely unauthenticated dispute resolution and false sense of security. | `const [totpCode] = useState(["7","4","2","9","8","1"]);` Unvalidated in `handleExecuteVerdict`. | Require real server-side session with `ADMIN` role and step-up authorization grant. | **PENDING** |
| **P0-06** | **P0** | State Mutation | `apps/web/src/stores/useDisputeStore.ts` | Direct array reassignment on Zustand store: `orderStore.orders = ...`. | Bypasses Zustand setters, breaks reactivity subscriptions, and risks state desynchronization. | `orderStore.orders = orderStore.orders.map((o) => ...)` | Remove client-side store mutations; replace with server API mutations. | **PENDING** |
| **P0-07** | **P0** | Transaction Atomicity | `apps/web/src/stores/useDisputeStore.ts` | Multi-store mutation spans `DisputeStore`, `OrderStore`, `WalletStore`, and `NotificationStore`. | Partial failures leave inconsistent state (e.g. order marked completed but wallet not credited). | Cascading calls across 4 independent stores without rollback capability. | Wrap multi-entity updates in `prisma.$transaction`. | **PENDING** |
| **P0-08** | **P0** | Financial Ledger | `apps/web/src/stores/useWalletStore.ts` | Wallet balances (`saldoAktif`, `saldoTertahan`) are scalar mutable numbers. | Balances can drift, cannot be audited, and are susceptible to client manipulation. | `saldoAktif: state.saldoAktif + amount` | Implement double-entry immutable ledger model (`WalletLedgerEntry`). | **PENDING** |
| **P0-09** | **P0** | Auth & RBAC | `apps/web/src/app/(auth)/login/page.tsx`, `useUserStore.ts` | Login simply stores user object in `localStorage`. No session tokens or password hashing. | Identity spoofing; any user can claim any identity or role by editing `localStorage`. | `login: (email) => set({ user: { ... } })` | Implement secure cookie-based session authentication with hashed credentials. | **PENDING** |
| **P0-10** | **P0** | Route Protection | `apps/web/src/app/(admin)/layout.tsx` | Admin console routes (`/admin/*`) lack server middleware protection. | Publicly accessible to any unauthenticated visitor who types the URL. | Layout is `"use client"` with no auth check or redirect. | Add Next.js middleware checking `ADMIN` session role before serving `/admin/*`. | **PENDING** |
| **P1-01** | **P1** | Lint Failures | Entire `apps/web` | ESLint reports 12 errors (unescaped quotes, `any` casts) and 98 unused variable warnings. | Violates code quality standards and prevents automated CI pipeline enforcement. | `✖ 110 problems (12 errors, 98 warnings)` in `pnpm --filter web lint`. | Fix all unescaped quotes, replace `any` with strict types, remove unused variables. | **PENDING** |
| **P1-02** | **P1** | SSR Hydration | `apps/web/src/app/(main)/chat/page.tsx` | Relative time calculation (`timeAgo`) differs between server render and client mount. | Hydration mismatch error in browser console (`2 menit lalu` vs `3 menit lalu`). | Browser console hydration warning on `/chat`. | Implement client-only mounted formatting or `suppressHydrationWarning`. | **PENDING** |
| **P1-03** | **P1** | Build Script | `apps/web/package.json` | Missing `"typecheck": "tsc --noEmit"` script. | Continuous integration cannot independently verify TypeScript types without a full Next build. | Missing script entry in `package.json`. | Add `"typecheck": "tsc --noEmit"`. | **PENDING** |
| **P2-01** | **P2** | Misleading Claims | `apps/web/src/app/(admin)/admin/disputes/page.tsx`, `help/escrow/page.tsx` | UI claims live connection to "OJK Audit Log" and "Kustodian Bank Indonesia". | Inaccurate compliance and regulatory representations. | Text: `tercatat di OJK Audit Log` in dispute verdict toast. | Re-label to truthful terms: "NgeBekasinYuk Internal Audit Log" and "Escrow Sandbox". | **PENDING** |
| **P2-02** | **P2** | Insecure IDs | `apps/web/src/stores/useOrderStore.ts`, `useDisputeStore.ts` | IDs generated via `Math.random()`. | Predictable IDs vulnerable to enumeration and collision under scale. | `STX-2026-${Math.floor(10000 + Math.random() * 90000)}` | Use collision-resistant UUIDv7 / nanoid identifiers. | **PENDING** |

---

## 4. Remediation Strategy & Next Steps

1. **Step 1**: Clean all ESLint errors and warnings across `apps/web`, add `typecheck` script, and resolve the hydration mismatch.
2. **Step 2**: Establish relational persistence with Prisma ORM, normalized schemas, ACID transaction support, and deterministic database seeds.
3. **Step 3**: Implement domain services (`OrderStateMachine`, `EscrowLedgerService`, `WalletLedgerService`, `DisputeService`, `AuditLogger`).
4. **Step 4**: Implement secure server-side session authentication, role-based access control, and route middleware for `/admin/*`.
5. **Step 5**: Expose server actions and API route handlers with Zod schema validation; wire client UI to server authority.
6. **Step 6**: Install Vitest and create comprehensive test suites for state transitions, financial invariants, idempotency, and RBAC.
7. **Step 7**: Configure GitHub Actions CI and compile final technical documentation.
