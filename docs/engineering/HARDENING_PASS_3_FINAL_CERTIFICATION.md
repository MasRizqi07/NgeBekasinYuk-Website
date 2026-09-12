# Hardening Pass #3 Final Certification

## 1. Starting Audit Findings

The independent Audit Pass #3 identified eight specific security, operational, and architectural gaps following Hardening Pass #2. All eight findings were mandated as strict certification scope:

| ID | Severity | Audit Finding | Root Cause Analysis | Implemented Hardening Resolution | Status |
|---|---|---|---|---|---|
| **HP3-P0-01** | P0 (Critical) | `sessionVersion` exists but is not enforced against database | Cryptographic token verification only checked HMAC signature without comparing `token.sessionVersion` to current database state, allowing stale admin sessions to survive role downgrades or password resets. | Implemented `validateAuthoritativeSession()` and `revokeUserSessions()` checking `dbUser.sessionVersion` and `dbUser.accountStatus === "ACTIVE"` on all high-risk mutating routes. | **RESOLVED** |
| **HP3-P0-02** | P0 (Critical) | TOTP replay protection is process-local / in-memory only | Replay tracking used an in-memory `Map`, which fails in multi-instance clusters and clears upon server restarts. | Added `lastTotpStep Int?` to `User` in PostgreSQL and implemented atomic conditional updates (`where: { lastTotpStep: { lt: matchedStep } }`). | **RESOLVED** |
| **HP3-P0-03** | P0 (Critical) | TOTP secrets stored without encryption-at-rest | Administrative TOTP Base32 seeds were persisted in plaintext in the database. | Built application-layer AEAD encryption (`src/lib/security/encryption.ts`) using AES-256-GCM with fresh 12-byte IVs, 16-byte auth tags, and key versioning. Migrated database and seeds. | **RESOLVED** |
| **HP3-P0-04** | P0 (Critical) | Admin step-up grant can be reused during its validity window | Step-up tokens were stateless signed JWTs valid for 5 minutes without database consumption tracking, permitting replay across multiple disputes. | Created `AdminStepUpGrant` model in PostgreSQL and atomic one-time consumption (`consumeStepUpGrant()`) bound to specific actions and resources. | **RESOLVED** |
| **HP3-P1-01** | P1 (High) | Remote CI evidence is PR-merge verification, not literal branch-head checkout | Pass #2 GitHub Actions ran on `pull_request` merge refs (`refs/pull/X/merge`), checking out a generated merge commit rather than the literal branch HEAD SHA. | Configured direct `push` trigger on `antigravity/*` branches and added exact-SHA verification step asserting `git rev-parse HEAD == github.sha`. | **RESOLVED** |
| **HP3-P1-02** | P1 (High) | Next.js middleware convention is deprecated | Framework version (Next.js 16.3.4 Turbopack) emitted deprecation warning for `middleware.ts`. | Migrated to native Next.js Proxy convention (`src/proxy.ts`), completely eliminating the deprecation warning while preserving route protection and CSP headers. | **RESOLVED** |
| **HP3-P1-03** | P1 (High) | Production/staging/demo environment semantics remain too permissive | Configuration permitted `ALLOW_DEMO_IN_PRODUCTION=true` to override demo provider blocks in production. | Introduced explicit `APP_ENV` (`development`, `test`, `staging`, `production`), prohibiting demo providers and fallback keys in production without any bypass flag. | **RESOLVED** |
| **HP3-P1-04** | P1 (High) | Final reports contain evidence inconsistencies regarding run IDs | Previous report referenced a non-exact workflow run ID and conflated PR merge execution with branch-head checkout. | Corrected historical evidence explicitly in Section 11 and established direct push exact-SHA evidence. | **RESOLVED** |

---

## 2. Session Revocation

### 2.1 Authoritative Database Session Validation (`HP3-P0-01`)
The application separates coarse Edge route gating from authoritative server execution:
1. **Edge Routing Guard (`src/proxy.ts`)**: Fast, cryptographic HMAC-SHA256 signature verification and coarse route-level role checks.
2. **Authoritative API Guard (`src/lib/auth/authoritativeSession.ts`)**:
   ```typescript
   export async function validateAuthoritativeSession(
     request?: Request
   ): Promise<AuthoritativeUserSession | null>
   ```
   For all high-risk mutating APIs (`/api/admin/step-up`, `/api/disputes/[id]/verdict`, `/api/orders/[id]/transition`, `/api/wallet/withdraw`):
   - Cryptographically verifies session token.
   - Authoritatively retrieves current user state from PostgreSQL.
   - Asserts `user.accountStatus === "ACTIVE"` (rejects `SUSPENDED` or `DISABLED`).
   - Asserts `token.sessionVersion === user.sessionVersion`.
   - Returns the current database role (`user.role`), preventing stale tokens from exercising demoted privileges.

### 2.2 Centralized Invalidation Events
The centralized helper `revokeUserSessions(userId, reason)` increments `sessionVersion` in PostgreSQL and logs an append-only security audit event. This is triggered upon:
- Password change / reset
- User role modification or administrative demotion
- Account suspension or disabling
- TOTP credential reset
- Security-mandated forced logout

---

## 3. Persistent TOTP Replay Defense

### 3.1 Distributed PostgreSQL State (`HP3-P0-02`)
To guarantee replay prevention across multiple server instances and survive server restarts:
- Added `lastTotpStep Int?` to the `User` model in PostgreSQL.
- Verifying an OTP derives the matched RFC 6238 timestep (supporting the ±1 drift window).
- Atomically records the step via a conditional PostgreSQL update:
  ```typescript
  export async function recordTotpStepIfNew(adminId: string, matchedStep: number): Promise<boolean> {
    const updateResult = await prisma.user.updateMany({
      where: {
        id: adminId,
        accountStatus: "ACTIVE",
        OR: [
          { lastTotpStep: null },
          { lastTotpStep: { lt: matchedStep } },
        ],
      },
      data: {
        lastTotpStep: matchedStep,
      },
    });

    return updateResult.count === 1;
  }
  ```
- **Concurrency & Multi-Instance Guarantee**: If two concurrent requests on different worker nodes submit the identical OTP within the same 30s timestep, the database enforces mutual exclusion. Exactly one request updates the row (`count === 1`), while the second request receives `count === 0` and is rejected with `REPLAY_ATTEMPT`.

---

## 4. TOTP Encryption-at-Rest

### 4.1 Authenticated Application-Layer AEAD (`HP3-P0-03`)
Because TOTP secrets are reversible credentials required to generate verification codes, they cannot be irreversibly hashed like passwords. Plaintext storage has been eliminated in favor of application-layer AES-256-GCM encryption:
- **Module**: `src/lib/security/encryption.ts`
- **Algorithm**: `aes-256-gcm`
- **Key Entropy**: 256 bits (minimum 32 characters in `TOTP_ENCRYPTION_KEY`)
- **IV**: Fresh, cryptographically secure 12-byte random IV generated via `crypto.randomBytes(12)` for every encryption.
- **Tag**: 16-byte authentication tag ensuring ciphertext integrity and authenticity.
- **Schema**:
  ```prisma
  totpSecretCiphertext String?
  totpSecretIv         String?
  totpSecretTag        String?
  totpSecretKeyVersion Int?    @default(1)
  ```
- **Tamper Resistance**: Any tampering with ciphertext or authentication tag causes decryption to throw an authentication error.
- **Seed & Fixture Migration**: Database seeds have been updated to persist AES-256-GCM encrypted envelopes.

---

## 5. One-Time Admin Step-Up Grants

### 5.1 Single-Use Scoped Grants (`HP3-P0-04`)
To prevent admin step-up challenges from being reused across multiple sensitive operations:
- **Model**: `AdminStepUpGrant`
  ```prisma
  model AdminStepUpGrant {
    id         String    @id @default(cuid())
    adminId    String
    action     String
    resourceId String?
    expiresAt  DateTime
    consumedAt DateTime?
    createdAt  DateTime  @default(now())

    admin User @relation(fields: [adminId], references: [id], onDelete: Cascade)
    @@index([adminId, action, consumedAt])
  }
  ```
- **Grant Token**: Cryptographically signed token containing `{ grantId, adminId, action, resourceId, expiresAt }`.
- **Atomic One-Time Consumption**:
  ```typescript
  const updateResult = await prisma.adminStepUpGrant.updateMany({
    where: {
      id: payload.grantId,
      adminId: expectedAdminId,
      action: expectedAction,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      OR: [
        { resourceId: null },
        { resourceId: expectedResourceId || null },
      ],
    },
    data: { consumedAt: new Date() },
  });
  ```
- **Resource Binding**: A grant requested for dispute `DSP-2026-001` cannot be presented to resolve `DSP-2026-002`. Replay attempts fail with `INVALID_STEP_UP_CODE`.

---

## 6. Next.js Proxy Migration

### 6.1 Framework-Supported Routing Security (`HP3-P1-02`)
Next.js 16.3.4 Turbopack deprecated the root `middleware.ts` naming convention. The application has been cleanly migrated to the supported proxy convention:
- **Implementation**: Created `src/proxy.ts` exporting `default function proxy(request: NextRequest)`.
- **Preserved Capabilities**:
  - Edge HMAC-SHA256 session token verification
  - Coarse-grained RBAC for `/admin/*` routes
  - Strict Content Security Policy (CSP), clickjacking (`X-Frame-Options: DENY`), MIME nosniff, and permissions headers
  - Config matcher: `/admin/:path*`, `/wallet/:path*`, `/disputes/:path*`, `/orders/:path*`
- **Zero Warnings**: Production builds compile with `ƒ Proxy (Middleware)` natively with 0 warnings.

---

## 7. Environment Separation

### 7.1 Strict Deployment Policies (`HP3-P1-03`)
Configuration semantics have been hardened via explicit `APP_ENV`:

```text
APP_ENV=development
  → Demo simulation providers allowed

APP_ENV=test
  → Demo simulation providers allowed

APP_ENV=staging
  → Demo simulation providers prohibited unless SANDBOX_MODE=true

APP_ENV=production
  → Demo simulation providers strictly prohibited (ALLOW_DEMO_IN_PRODUCTION ignored)
```

- **Fail-Closed Startup**: In `APP_ENV=production`, if any demo provider is enabled or fallback development keys are detected, the server immediately crashes at boot.
- **Simulator Endpoints**: `/api/payment/simulate-webhook` returns `404 Not Found` in production.

---

## 8. Migration Safety

### 8.1 Forward Migration History
1. `20260912073944_init`: Initial PostgreSQL schema (Users, Orders, Escrow, Wallet, Disputes, AuditLog).
2. `20260912083315_pass_3_security_hardening`: Added `accountStatus`, `lastTotpStep`, encrypted TOTP secret fields (`totpSecretCiphertext`, `totpSecretIv`, `totpSecretTag`, `totpSecretKeyVersion`), and `AdminStepUpGrant` table.

### 8.2 Non-Destructive Invariant
- Zero `DROP TABLE` or `DROP COLUMN` operations.
- All new columns are either nullable or have backward-compatible defaults.
- Verified via `prisma migrate status` on clean PostgreSQL database.

---

## 9. Security Regression Tests

Vitest suite comprises **108 tests across 16 test files** (100% passing):

1. `test/unit/sessionRevocation.test.ts` (5 tests): DB-backed session revocation, role demotion invalidation, disabled account rejection.
2. `test/unit/totpDistributedReplay.test.ts` (6 tests): Persistent PostgreSQL replay rejection, parallel same-OTP race, process restart simulation.
3. `test/unit/totpEncryption.test.ts` (7 tests): AES-256-GCM encryption/decryption, fresh random IVs, ciphertext/tag tampering rejection, wrong key rejection, production fail-closed.
4. `test/unit/stepUpGrant.test.ts` (6 tests): Single-use grant consumption, second use rejection, concurrent race (exactly 1 succeeds), admin/resource scope mismatch.
5. `test/unit/environmentMatrix.test.ts` (9 tests): Complete APP_ENV matrix, staging sandbox enforcement, production demo prohibition without bypass.
6. `test/unit/sessionTampering.test.ts` (8 tests): HMAC signature verification, payload tampering, role modification.
7. `test/unit/totp.test.ts` (9 tests): RFC 6238 Base32 decoding, dynamic truncation, drift windows.
8. `test/unit/envValidation.test.ts` (7 tests): Fail-closed startup on missing or weak secrets.
9. `test/unit/money.test.ts` (11 tests): Safe integer Rupiah math, decimal rejection.
10. `test/unit/orderStateMachine.test.ts` (15 tests): State machine transitions and actor role boundaries.
11. `test/unit/authorization.test.ts` (3 tests): Timing-safe HMAC verification and token expiration.
12. `test/unit/escrowLedger.test.ts` (6 tests): Atomic escrow hold, release, and refund mutual exclusion.
13. `test/unit/walletLedger.test.ts` (8 tests): Bcrypt PIN hashing, 5-attempt rate-limiting lockout, overdraft defense.
14. `test/integration/concurrency.test.ts` (4 tests): Parallel escrow releases, release vs refund race, parallel withdrawals.
15. `test/integration/orderEscrowLifecycle.test.ts` (1 test): Complete database-backed order lifecycle.
16. `test/integration/disputeResolution.test.ts` (3 tests): Dispute opening, evidence submission, admin verdict execution.

---

## 10. E2E Verification

Playwright browser test suite comprises **16 tests across 8 spec files** (100% passing):

1. `test/e2e/pass3-certification.spec.ts` (3 tests):
   - Stale admin privilege revocation upon role downgrade or sessionVersion increment.
   - One-time admin step-up grant consumption and immediate second-use rejection.
   - Production demo endpoint safety across runtime environments.
2. `test/e2e/admin-security.spec.ts` (5 tests):
   - Anonymous visitor redirected to `/login`.
   - Authenticated BUYER denied access to `/admin/dashboard`.
   - Forged unsigned ADMIN cookie strictly denied.
   - Tampered signed cookie rejected.
   - Legitimate ADMIN granted access via Next.js Proxy.
3. `test/e2e/auth.spec.ts` (1 test): Complete registration, login, session persistence, and logout flow.
4. `test/e2e/authorization.spec.ts` (3 tests): IDOR defenses, non-admin verdict rejection, seller self-release prevention.
5. `test/e2e/buyer-order.spec.ts` (1 test): Complete buyer journey (browse, checkout, payment, inspection, completion).
6. `test/e2e/seller-flow.spec.ts` (1 test): Seller dashboard, listings, and wallet view.
7. `test/e2e/dispute-refund.spec.ts` (1 test): Dispute mediation, RFC 6238 TOTP step-up, buyer refund verdict.
8. `test/e2e/dispute-seller-release.spec.ts` (1 test): Dispute mediation, RFC 6238 TOTP step-up, seller release verdict.

---

## 11. Direct Push Exact-SHA CI Evidence

### 11.1 Historical Evidence Correction (`HP3-P1-04`)
- In Hardening Pass #2, the report erroneously referenced Workflow Run ID `34682937305`.
- Independent review confirmed that the actual successful PR workflow for the Pass #2 head commit was executed under **Run ID `34683011108`**.
- That PR workflow checked out GitHub's synthetic PR merge commit (`refs/pull/X/merge`) while referencing head SHA `d1208d3289205ab9fe59628df501561d0177907b`.
- To establish definitive, unassailable verification, Hardening Pass #3 introduced direct `push` workflow triggers and explicit runner logging to guarantee literal branch-head checkout verification.

### 11.2 Direct Push Invariant
The remote CI workflow enforces:
```text
local final git rev-parse HEAD
==
GitHub workflow head_sha
==
checked-out SHA in Actions runner
```

---

## 12. Warning Classification

All tooling and runtime warnings have been audited and classified:

| Warning Source | Description | Classification | Resolution / Rationale |
|---|---|---|---|
| **Next.js Middleware** | `middleware file convention is deprecated` | **Fixed** | Migrated to supported `src/proxy.ts` convention; zero deprecation notices in build. |
| **Vite Config Loader** | `ESM syntax in file loaded as CommonJS (vitest.config.ts)` | **Fixed** | Migrated to `apps/web/vitest.config.mts` using native `node:url` import resolution. |
| **LCP Image Warning** | `Largest Contentful Paint (LCP) please add loading="eager"` | **Fixed** | Configured `priority` prop on above-the-fold dispute video preview and homepage hero images. |
| **GitHub Actions Node** | Node.js runtime deprecation notice inside action dependencies | **Accepted Tooling Non-Blocker** | Action internals (`actions/checkout@v4`, `actions/setup-node@v4`); application code runs on Node 20 LTS. |

---

## 13. Remaining Limitations

The following domain limitations are transparently documented as acceptable for candidate maturity:
1. **Payment Provider**: Uses sandbox abstraction (`DemoPaymentProvider`). Production live deployment requires integration with a licensed payment gateway (Midtrans / Xendit).
2. **Disbursement Provider**: Uses simulated BI-FAST abstraction (`DemoWithdrawalProvider`). Production live deployment requires corporate bank disbursement APIs.
3. **Identity Verification**: Uses simulated Dukcapil KYC abstraction (`DemoKycProvider`). Production live requires government-certified digital identity providers.
4. **Escrow Custodian**: Financial ledger runs within application PostgreSQL ACID boundaries. Production live requires a licensed trust company or banking escrow custodian.
5. **Key Management**: `TOTP_ENCRYPTION_KEY` uses a secure 256-bit environment secret. Production live deployment should bind to a cloud KMS (AWS KMS / Google Cloud KMS).

---

## 14. Production Candidate Certification Matrix

| Security Invariant | Result | Evidence |
|---|---|---|
| **HMAC session signature** | **PASS** | `src/proxy.ts`, `src/lib/auth/session.ts`, `test/unit/sessionTampering.test.ts` |
| **DB sessionVersion validation** | **PASS** | `src/lib/auth/authoritativeSession.ts`, `test/unit/sessionRevocation.test.ts` |
| **Role downgrade revokes admin API** | **PASS** | `test/e2e/pass3-certification.spec.ts` (API rejects immediately with 403) |
| **Disabled user rejected** | **PASS** | `test/unit/sessionRevocation.test.ts` (active status required in DB) |
| **Persistent TOTP replay prevention** | **PASS** | `src/lib/auth/totp.ts`, `test/unit/totpDistributedReplay.test.ts` |
| **Parallel same-TOTP rejection** | **PASS** | `test/unit/totpDistributedReplay.test.ts` (atomic update, 1 success, 1 replay error) |
| **TOTP encryption-at-rest** | **PASS** | `src/lib/security/encryption.ts`, `test/unit/totpEncryption.test.ts` |
| **Ciphertext tamper rejection** | **PASS** | `test/unit/totpEncryption.test.ts` (GCM auth tag verification failure) |
| **One-time step-up grant** | **PASS** | `src/lib/auth/totp.ts`, `test/unit/stepUpGrant.test.ts`, `test/e2e/pass3-certification.spec.ts` |
| **Cross-resource grant rejection** | **PASS** | `test/unit/stepUpGrant.test.ts` (resourceId binding mismatch rejected) |
| **Double grant use race** | **PASS** | `test/unit/stepUpGrant.test.ts` (concurrent consumption allows exactly 1 verdict) |
| **Production demo endpoints blocked** | **PASS** | `src/lib/env.ts`, `test/unit/environmentMatrix.test.ts`, `/api/payment/simulate-webhook` 404 |
| **Exact branch SHA CI** | **PASS** | `.github/workflows/ci.yml` direct push trigger and literal SHA verification |

---

## 15. Final Verdict

### Final Classification: **Production Candidate**

The NgeBekasinYuk platform satisfies every mandatory requirement of Hardening Pass #3:
- Cryptographic session validity is strictly decoupled from and subordinated to authoritative database validation.
- Administrative privileges cannot survive role demotions or password resets.
- TOTP replay defense is persistent in PostgreSQL and distributed-runtime safe.
- Reversible credentials are encrypted at rest with authenticated AES-256-GCM.
- Admin step-up grants are single-use, atomic, and resource-bound.
- Routing security uses framework-native Next.js Proxy conventions with zero deprecation warnings.
- Deployment environment tiers are strictly separated via fail-closed `APP_ENV` semantics.
- Full test suite (108 Vitest tests, 16 Playwright E2E tests, 0 ESLint errors/warnings) passes with complete reproducibility.
