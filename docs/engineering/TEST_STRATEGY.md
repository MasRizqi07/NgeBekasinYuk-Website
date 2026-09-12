# NgeBekasinYuk Testing Strategy & Quality Assurance
### Hardening Pass #3 Final Production Candidate Certification Standards

## 1. Testing Philosophy

The testing strategy prioritizes **cryptographic verification, authoritative session revocation, distributed TOTP replay defense, secret encryption-at-rest, single-use step-up authorization, financial concurrency, and browser end-to-end user journeys** over superficial snapshot testing.

- **Unit & Integration**: Vitest v4.1.x running natively on PostgreSQL 16+ (108 tests across 16 suites).
- **End-to-End (E2E)**: Playwright v1.50+ running on Chromium with real Next.js server and database transactions (16 tests across 8 suites).

---

## 2. Test Pyramid & Execution Summary

```text
         ▲
        / \        Playwright Browser E2E Tests (16 Tests, 8 Suites)
       /   \       Critical user journeys, cookie forgery attacks, stale admin revocation, single-use grants
      /-----\
     /       \     PostgreSQL Integration & Concurrency Tests (8 Tests, 3 Suites)
    /         \    Parallel escrow release, refund races, withdrawal overdrafts, verdicts
   /-----------\
  /             \  Security & Domain Unit Tests (100 Tests, 13 Suites)
 /---------------\ Session revocation, distributed TOTP replay, AES-256-GCM encryption, env matrix
```

### Complete Vitest Test Suites (108 Tests, 100% Passing)

| Test Suite | Category | Tests | Key Scenarios Verified |
|---|---|---|---|
| `test/unit/sessionRevocation.test.ts` | Security (HP3-P0-01) | 5 | DB-enforced `sessionVersion`, stale admin token rejection after role downgrade, disabled user rejection, password reset invalidation |
| `test/unit/totpDistributedReplay.test.ts` | Security (HP3-P0-02) | 6 | Persistent PostgreSQL replay defense, parallel same-OTP race rejection (exactly 1 succeeds), drift window adherence, process restart simulation |
| `test/unit/totpEncryption.test.ts` | Security (HP3-P0-03) | 7 | AES-256-GCM encryption/decryption, fresh random IV per run, ciphertext tamper rejection, auth tag tamper rejection, wrong key rejection, fail-closed production |
| `test/unit/stepUpGrant.test.ts` | Security (HP3-P0-04) | 6 | Single-use grant consumption, second use rejection, concurrent race (exactly 1 succeeds), admin binding check, resource scope binding check, signature tampering rejection |
| `test/unit/environmentMatrix.test.ts` | Security (HP3-P1-03) | 9 | Development/test/staging/production matrix, staging sandbox flag check, production demo block without bypass, dev fallback secret rejection |
| `test/unit/sessionTampering.test.ts` | Security | 8 | Valid HMAC token, invalid signature, modified role, modified userId, modified expiry, truncated token, garbage token, expired token |
| `test/unit/totp.test.ts` | Security | 9 | RFC 6238 TOTP generation, ±1 drift window, dynamic truncation, replay defense, invalid base32, step-up grant creation & expiry |
| `test/unit/envValidation.test.ts` | Security | 7 | Production fail-closed on missing `AUTH_SECRET`, weak secret (<32 chars), dev fallback rejection, PostgreSQL URL requirement, demo provider guard |
| `test/unit/money.test.ts` | Financial | 11 | Safe integer IDR arithmetic, decimal rejection, negative rejection, overflow boundaries, escrow fee splits |
| `test/unit/orderStateMachine.test.ts` | Domain | 15 | Valid lifecycle transitions, invalid transition jumps, actor permissions, ownership checks, terminal state immutability |
| `test/unit/authorization.test.ts` | Security | 3 | HMAC signing, constant-time verification, tampering resistance, expiration checks |
| `test/unit/escrowLedger.test.ts` | Domain | 6 | Escrow release, idempotency deduplication, refund mutual exclusion, dispute freeze, self-release prevention |
| `test/unit/walletLedger.test.ts` | Domain | 8 | Bcrypt PIN verification, 5-attempt rate-limit lockout, withdrawal balance validation, duplicate withdrawal idempotency |
| `test/integration/concurrency.test.ts` | Concurrency | 4 | Parallel escrow releases (exactly 1 succeeds), release vs refund race (mutually exclusive), parallel withdrawal race (no overdraft), conflicting admin dispute verdicts |
| `test/integration/orderEscrowLifecycle.test.ts` | Integration | 1 | Complete database-backed order lifecycle (payment -> shipping -> delivery -> receipt -> escrow release) |
| `test/integration/disputeResolution.test.ts` | Integration | 3 | Dispute opening -> escrow freezing -> admin REFUND_BUYER verdict -> admin RELEASE_SELLER verdict |

### Playwright Browser E2E Suites (16 Tests, 100% Passing)

| E2E Spec File | Tests | Key Browser Journeys Verified |
|---|---|---|
| `test/e2e/pass3-certification.spec.ts` | 3 | Stale admin privilege revocation (HP3-P0-01), one-time step-up grant consumption & replay rejection (HP3-P0-04), production demo endpoint safety (HP3-P1-03) |
| `test/e2e/admin-security.spec.ts` | 5 | Anonymous redirect, buyer 403 denial, forged unsigned cookie denial, tampered signed cookie rejection, valid admin access via Next.js Proxy |
| `test/e2e/auth.spec.ts` | 1 | Buyer registration, login, signed session cookie persistence, wrong password rejection, logout |
| `test/e2e/authorization.spec.ts` | 3 | IDOR: non-admin dispute verdict 403, non-admin step-up 403, seller escrow self-release 403 |
| `test/e2e/buyer-order.spec.ts` | 1 | Browse marketplace catalog, checkout, demo payment, delivery simulation, inspection countdown, receipt confirmation, completed escrow |
| `test/e2e/seller-flow.spec.ts` | 1 | Seller listing creation, profile display, wallet active balance and transaction history inspection |
| `test/e2e/dispute-refund.spec.ts` | 1 | Dispute mediation room, real RFC 6238 TOTP admin step-up, dispute review, buyer refund verdict, escrow refund |
| `test/e2e/dispute-seller-release.spec.ts` | 1 | Dispute mediation room, real RFC 6238 TOTP admin step-up, dispute review, seller release verdict, escrow release to seller wallet |

---

## 3. Verification Commands

```bash
# 1. Run ESLint (0 errors, 0 warnings)
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
