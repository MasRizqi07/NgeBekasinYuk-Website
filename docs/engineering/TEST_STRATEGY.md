# NgeBekasinYuk Testing Strategy & Quality Assurance

## 1. Testing Philosophy

The testing strategy prioritizes **cryptographic verification, financial concurrency, state machine enforcement, authorization boundaries, and real browser end-to-end user journeys** over superficial snapshot testing.

- **Unit & Integration**: Vitest v4.1.x running on real PostgreSQL 16+.
- **End-to-End (E2E)**: Playwright v1.50+ running on Chromium with real Next.js server and database transactions.

---

## 2. Test Pyramid & Execution Summary

```text
         ▲
        / \        Playwright Browser E2E Tests (13 Tests, 7 Suites)
       /   \       Critical user journeys, cookie forgery attacks, real TOTP step-up
      /-----\
     /       \     PostgreSQL Integration & Concurrency Tests (8 Tests, 3 Suites)
    /         \    Parallel escrow release, refund races, withdrawal overdrafts, verdicts
   /-----------\
  /             \  Unit Tests (67 Tests, 8 Suites)
 /---------------\ Session tampering, RFC 6238 TOTP, env fail-closed, money math, order state
```

### Complete Vitest Test Suites (75 Tests, 100% Passing)

| Test Suite | Category | Tests | Key Scenarios Verified |
|---|---|---|---|
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

### Playwright Browser E2E Suites (13 Tests, 100% Passing)

| E2E Spec File | Tests | Key Browser Journeys Verified |
|---|---|---|
| `test/e2e/admin-security.spec.ts` | 5 | Anonymous redirect, buyer 403 denial, forged unsigned cookie denial, tampered signed cookie rejection, valid admin access |
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

# 3. Unit, Integration & Concurrency Test Suite (75 passing tests)
pnpm --filter web run test

# 4. Production App Router Build (27 routes generated)
pnpm --filter web run build

# 5. Playwright Browser E2E Test Suite (13 passing tests)
pnpm --filter web run test:e2e
```
