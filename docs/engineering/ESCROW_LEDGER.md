# NgeBekasinYuk Append-Only Escrow & Wallet Ledger Specification

## 1. Financial Principles

1. **Integer Money Model**: All monetary values are represented as non-negative safe integers in Indonesian Rupiah (IDR). Floating-point arithmetic is strictly prohibited across domain models and database schemas.
2. **Append-Only Paired Ledger Records**: Every financial movement (deposit hold, escrow release, buyer refund, seller withdrawal) generates immutable, append-only records in `EscrowLedgerEntry` and/or `WalletLedgerEntry`. Direct updates or deletions of existing ledger entries are strictly prohibited.
3. **Database-Native Concurrency Controls**: Financial mutations execute within atomic database transactions with decisive conditional invariants checked at the database layer (e.g. `isReleased = false`, `activeBalance >= amount`).
4. **Mutual Exclusion**: An escrow account can either be released to the seller or refunded to the buyer, but never both.
5. **Dispute Freeze Invariant**: When an order enters dispute, funds are frozen in the escrow account (`isReleased = false`, `isRefunded = false`) and cannot be released or withdrawn until an authorized administrator enters an atomic resolution verdict.
6. **Reconciliation Invariant**: The cached `wallet.activeBalance` and `escrowAccount.amount` must strictly reconcile against the aggregate of their respective append-only ledger entries.

---

## 2. Escrow Accounting Lifecycle

```text
Buyer Payment Settled
        ↓
EscrowAccount (amount: 10,000,000 IDR, status: HELD)
EscrowLedgerEntry (type: DEPOSIT, direction: CREDIT, amount: +10,000,000)
Seller Wallet (heldBalance: +10,000,000, activeBalance: 0)

                     ↙                                      ↘
          [Normal Delivery Flow]                                [Dispute Flow]
Buyer Confirms Receipt / Auto-Release              Dispute Opened (Escrow Frozen)
        ↓                                                       ↓
Prisma Transaction (Atomic Conditional Update):     Admin RFC 6238 TOTP Step-Up
  escrowAccount.updateMany({                          Dispute Verdict Transaction:
    where: { id, isReleased: false },                   ↙                        ↘
    data: { isReleased: true }                     [Refund Buyer]           [Release Seller]
  }) (count === 1 invariant)                             ↓                         ↓
EscrowLedgerEntry (RELEASE_SELLER, DEBIT)          escrowAccount.update:    escrowAccount.update:
Seller Wallet:                                       isRefunded = true        isReleased = true
  heldBalance: -10,000,000                         EscrowLedgerEntry:       EscrowLedgerEntry:
  activeBalance: +10,000,000                         REFUND_BUYER (DEBIT)     RELEASE_SELLER (DEBIT)
WalletLedgerEntry (ESCROW_RELEASE, CREDIT)         Buyer Account:           Seller Wallet:
                                                     Refunded 100%            activeBalance: +10,000,000
                                                                            WalletLedgerEntry (CREDIT)
```

---

## 3. Concurrency Protection & Race Defense

### 3.1 Escrow Release & Refund Mutual Exclusion
Prior to Hardening Pass #2, escrow state was inspected before entering the mutation transaction, exposing a potential race window (`HP2-P0-04`). In Pass #2, the decisive check occurs directly inside the transaction using conditional updates:
```ts
const updateResult = await tx.escrowAccount.updateMany({
  where: {
    id: escrow.id,
    isReleased: false,
    isRefunded: false,
  },
  data: {
    isReleased: true,
  },
});

if (updateResult.count === 0) {
  // Concurrently claimed by another release or refund transaction
  return { success: false, reason: "CONCURRENT_MUTATION_REJECTED" };
}
```
This guarantees that:
- `release + release` => exactly one succeeds.
- `release + refund` => mutually exclusive; only one commits.
- `refund + refund` => exactly one refund executes.

### 3.2 Withdrawal Concurrency & Lost Update Defense (`HP2-P0-05`)
Withdrawals avoid in-memory balance calculation (`read balance -> compute -> update`). Instead, they execute an atomic conditional decrement inside the database transaction:
```ts
const updateResult = await tx.wallet.updateMany({
  where: {
    id: wallet.id,
    activeBalance: { gte: amount },
  },
  data: {
    activeBalance: { decrement: amount },
  },
});

if (updateResult.count === 0) {
  throw new WalletDomainError("INSUFFICIENT_BALANCE_OR_CONCURRENT_DECREMENT");
}
```
If two parallel withdrawal requests of Rp 800,000 arrive simultaneously on a balance of Rp 1,000,000:
- First transaction decrements balance from 1,000,000 to 200,000 and commits.
- Second transaction encounters `activeBalance: { gte: 800,000 }` which evaluates to false (`count === 0`) and rolls back safely.

---

## 4. Idempotency Key Semantics

Idempotency keys are explicitly scoped to prevent accidental permanent deduplication of legitimate future operations (`HP2-P1-10`):

1. **Escrow Release / Refund**: Scoped deterministically to the unique order lifecycle event:
   - Release: `buildIdempotencyKey("ESCROW_RELEASE", orderId, "SELLER_PAYOUT")`
   - Refund: `buildIdempotencyKey("ESCROW_REFUND", orderId, "BUYER_REFUND")`
2. **Dispute Verdict**: Scoped deterministically to the dispute:
   - `buildIdempotencyKey("DISPUTE_VERDICT", disputeId, verdictType)`
3. **Wallet Withdrawal**: Scoped to the specific withdrawal request instance (e.g. client/server-generated request UUID) rather than solely `walletId:amount:accountNumber`. This ensures retries of the *same* withdrawal request are deduplicated without preventing the user from executing a legitimate identical withdrawal on a later date.
