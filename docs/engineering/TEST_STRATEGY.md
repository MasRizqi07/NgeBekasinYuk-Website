# NgeBekasinYuk Testing Strategy & Quality Assurance

## 1. Testing Philosophy

The testing strategy prioritizes **financial correctness, state machine enforcement, authorization boundaries, and concurrency idempotency** over shallow UI snapshot testing.

Test Runner: **Vitest v4.x** with Node environment and real database transactions.

---

## 2. Test Pyramid & Execution Summary

```text
       ▲
      / \        E2E Tests (Playwright / Critical User Flows)
     /   \
    /     \      Integration Tests (Database-backed Order, Escrow, Dispute Lifecycles)
   /-------\
  /         \    Unit Tests (Money Math, OrderStateMachine, PIN Lockout, HMAC Auth)
 /-----------\
```

### Current Test Suite (47 Tests, 100% Passing)

| Test File | Category | Tests | Key Scenarios Verified |
|---|---|---|---|
| `test/unit/money.test.ts` | Unit | 11 | Safe integer IDR, float rejection, non-negative arithmetic, escrow fee splits |
| `test/unit/orderStateMachine.test.ts` | Unit | 15 | Valid transitions, invalid jumps, actor permissions, ownership checks, terminal state immutability |
| `test/unit/authorization.test.ts` | Unit | 3 | HMAC signing, constant-time verification, tampering resistance, expiration checks |
| `test/unit/escrowLedger.test.ts` | Unit | 6 | Escrow release, P0-03 idempotency, mutual exclusion with refund, dispute freeze, self-release prohibition |
| `test/unit/walletLedger.test.ts` | Unit | 8 | P0-04 PIN bug fix, 5-attempt rate limit lockout, withdrawal balance validation, duplicate withdrawal idempotency |
| `test/integration/orderEscrowLifecycle.test.ts` | Integration | 1 | Complete database-backed order lifecycle (payment -> shipping -> delivery -> receipt -> escrow release) |
| `test/integration/disputeResolution.test.ts` | Integration | 3 | Dispute opening -> escrow freezing -> admin REFUND_BUYER verdict -> admin RELEASE_SELLER verdict |

---

## 3. Running Test Commands

```bash
# Run all unit and integration tests
pnpm --filter web test

# Run tests in watch mode
pnpm --filter web test:watch

# Run linter
pnpm --filter web lint

# Run strict TypeScript check
pnpm --filter web typecheck

# Run production bundle build
pnpm --filter web build
```
