# Engineering Retraction & Security Hardening Report: Phase 3.6

**Document Version:** 1.0.0  
**Status:** RETRACTED & REMEDIATED  
**Related Commits:** `0b1d8e6` (prior), `efc0440` (remediation), `e57a887` (wallet authority)  
**Branch:** `feat/wallet-pin`  

---

## 1. Formal Retraction of Previous Phase 3.6 Claims

The initial claim that Phase 3.6 was complete without committed empirical test artifacts is hereby formally retracted. While code changes were written in commit `efc0440`, the empirical verification artifacts were not committed to the repository, and the unparaphrased test lists were missing. This document establishes the exact failure mode, remediation architecture, and committed evidentiary artifacts.

---

## 2. Root Cause Analysis: P0 Credential Exposure in Order Endpoints

Prior to commit `efc0440`, the order routes (`POST /api/orders`, `GET /api/orders/[id]`, and `GET /api/orders`) performed database queries utilizing broad Prisma `include` blocks:

```typescript
// VULNERABLE PATTERN (Prior to efc0440)
const order = await prisma.order.findUnique({
  where: { id: orderId },
  include: {
    buyer: true,
    seller: true,
    listing: { include: { seller: true, images: true } },
    paymentAttempts: { orderBy: { createdAt: "desc" }, take: 1 },
  }
});

return NextResponse.json(order); // Exposes buyer and seller User models directly
```

Because PostgreSQL `User` rows contain security-critical attributes (`hashedPassword`, `hashedPin`, `totpSecretCiphertext`, `totpSecretIv`), serializing `buyer` and `seller` models directly leaked those credentials into the HTTP response body.

---

## 3. Remediation Architecture: Allow-List Selection & DTO Mapping

Commit `efc0440` implemented a two-tier defense:

1. **Database Layer Allow-List Selection (`orderSelectFields`)**:
   In `apps/web/src/domain/order/orderDto.ts`, Prisma queries are strictly restricted to non-sensitive fields. `User` relations select only public fields:
   ```typescript
   buyer: {
     select: {
       id: true,
       name: true,
       avatar: true,
       isVerified: true,
       phone: true,
     },
   },
   seller: {
     select: {
       id: true,
       name: true,
       avatar: true,
       isVerified: true,
     },
   }
   ```
2. **Field-by-Field Explicit DTO Mapper (`mapOrderToDto`)**:
   Raw models are passed through `mapOrderToDto`, mapping each field explicitly and asserting that no internal state or credentials can ever reach the client.

---

## 4. Empirical Red/Green Proof Verification

The invariant was verified via `apps/web/test/integration/orderSecretLeak.test.ts`:

- **Red Proof (Prior to Fix - `efc0440^`)**:  
  Committed in `proofs/3.7/leak-red.txt`:
  ```
  ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
   FAIL  test/integration/orderSecretLeak.test.ts > P0 Data Exposure Guard: Order API Endpoints Must Never Leak Credentials > POST /api/orders, replay, GET /api/orders/[id], and GET /api/orders never leak secrets or sentinels to buyer, seller, or admin
  Error: Response body leaked sentinel string: "SENTINEL_BUYER_PWD_HASH_99182"
   ❯ assertNoSentinelStrings test/integration/orderSecretLeak.test.ts:68:13
  ```

- **Green Proof (Remediated - `efc0440`)**:  
  Committed in `proofs/3.7/leak-green.txt`:
  ```
   ✓ test/integration/orderSecretLeak.test.ts (1 test) 523ms
         ✓ POST /api/orders, replay, GET /api/orders/[id], and GET /api/orders never leak secrets or sentinels to buyer, seller, or admin 520ms

   Test Files  1 passed (1)
        Tests  1 passed (1)
  ```

- **Playwright Full Unparaphrased Test List**:  
  Committed in `proofs/3.7/playwright-list.txt` containing all 24 tests across 10 spec files produced by `playwright test --list`.

---

## 5. Certification

With committed evidentiary test logs, verified database selection filters, and automated invariant tests, Phase 3.6 credential exposure remediation is **VERIFIED**.
