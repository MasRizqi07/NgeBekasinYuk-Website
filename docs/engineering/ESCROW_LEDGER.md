# NgeBekasinYuk Escrow & Wallet Double-Entry Ledger Specification

## 1. Financial Principles

1. **Integer Money Model**: All monetary values are represented as non-negative safe integers in Indonesian Rupiah (IDR). No floating-point arithmetic is permitted in domain operations.
2. **Double-Entry Ledger Integrity**: Every financial movement (deposit, hold, release, refund, withdrawal) generates an immutable, append-only ledger entry.
3. **Idempotency Guarantee**: Every sensitive operation requires an idempotency key. Duplicate calls produce the exact same outcome without duplicate balance alterations (`P0-03`).
4. **Mutual Exclusion**: An escrow account can either be `RELEASED` or `REFUNDED`, but never both.
5. **Dispute Freeze Invariant**: If an order enters dispute, funds are marked `FROZEN_DISPUTE` and cannot be withdrawn or released until an authorized administrator enters a resolution verdict.

---

## 2. Escrow Accounting Lifecycle

```text
Buyer Payment Settled
        ↓
EscrowAccount (amount: 10,000,000 IDR, status: HELD)
EscrowLedgerEntry (type: DEPOSIT, direction: CREDIT, amount: +10,000,000)
Seller Wallet (heldBalance: +10,000,000, activeBalance: 0)

                     ↙                      ↘
          [Normal Flow]                            [Dispute Flow]
Buyer Confirms Receipt / Auto-Release      Dispute Opened (status: FROZEN_DISPUTE)
        ↓                                           ↓
EscrowAccount.isReleased = true            Admin Verdict Decision
EscrowLedgerEntry (RELEASE_SELLER, DEBIT)   ↙                           ↘
Seller Wallet:                           [Refund Buyer]             [Release Seller]
  heldBalance: -10,000,000                     ↓                            ↓
  activeBalance: +10,000,000             EscrowAccount:               EscrowAccount:
WalletLedgerEntry (ESCROW_RELEASE, CREDIT) isRefunded = true            isReleased = true
                                         EscrowLedgerEntry:           EscrowLedgerEntry:
                                           REFUND_BUYER (DEBIT)         RELEASE_SELLER (DEBIT)
                                         Buyer Account:               Seller Wallet:
                                           Refunded 100%                activeBalance: +10,000,000
```

---

## 3. Idempotency Key Schema

Idempotency keys are computed deterministically or passed by client mutation requests:
- Escrow Release: `buildIdempotencyKey("ESCROW_RELEASE", orderId, "SELLER_PAYOUT")`
- Escrow Refund: `buildIdempotencyKey("ESCROW_REFUND", orderId, "BUYER_REFUND")`
- Wallet Withdrawal: `buildIdempotencyKey("WITHDRAWAL", walletId, amount + ":" + accountNumber)`

When a duplicate release request arrives:
1. `EscrowAccount.isReleased` is checked.
2. If `true`, the service queries `EscrowLedgerEntry` by unique `idempotencyKey`.
3. If matching ledger entry exists, the function returns `{ success: true, isDuplicate: true }` without mutating wallet balance again.
4. If an attempt is made to release under a different transaction key, `EscrowDomainError("ESCROW_ALREADY_RELEASED")` is thrown.
