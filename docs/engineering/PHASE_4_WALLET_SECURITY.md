# NgeBekasinYuk Server-Authoritative Wallet Security & Payout Architecture Specification
### Phase 4 & Phase 4B Hardening Standards

---

## 1. Executive Summary & Invariants

This specification defines the server-authoritative financial architecture for the NgeBekasinYuk seller wallet, payout destination integrity, transaction PIN security, and withdrawal processing.

### Non-Negotiable Invariants
1. **Server Authority**: The PostgreSQL database is the single authoritative source of truth for all financial balances, held funds, ledger entries, bank accounts, and PIN status.
2. **Client State Non-Authority**: Browser-side stores (such as Zustand) must never hold authoritative financial balances, must not persist financial values in `localStorage`, and must not fabricate transactions or balance deductions.
3. **Canonical Destination Resolution**: The client never supplies canonical bank metadata (bank name, account number, account holder) for withdrawal execution. The client supplies only a registered `bankAccountId`.
4. **Ownership Verification**: Bank account destination resolution strictly binds `id = bankAccountId AND userId = authenticatedSession.id` in the database query. Foreign or non-existent accounts are rejected without leaking existence or details.
5. **Idempotency & Replay Protection**: Withdrawals must supply a unique `Idempotency-Key` HTTP header. Replaying the identical key returns the cached canonical transaction outcome without double-debiting.
6. **Zero Leakage**: Internal credential material, PIN hashes, password hashes, failed-attempt counters, lock timestamps, and full unmasked bank account numbers are strictly excluded from client-facing DTOs.
7. **Honest Product Representation**: No claims of Bank Indonesia (BI) registration, custodian licensing, or regulatory certifications exist without external legal verification. All withdrawal execution is explicitly marked as simulated demo processing.

---

## 2. Transaction PIN Security Lifecycle (Phase 4)

### 2.1 No Default Production PIN
Newly registered accounts are created with `hashedPin: null`. No fallback or default PIN (such as "123456") is ever assigned automatically.
- Accounts without a PIN return `security.hasPin === false` on `GET /api/wallet`.
- When an account without a PIN attempts a withdrawal, the domain rejects the transaction with error code `PIN_NOT_SET` (HTTP 409).
- The `PIN_NOT_SET` status does not increment failed attempt counters.

### 2.2 PIN Creation & Password Verification
Initial PIN setup is performed via `POST /api/wallet/pin`:
- **Payload**: `{ password: string, pin: string }`.
- **Password Re-verification**: The user's account password must be re-authenticated using `bcrypt.compare`.
- **Brake on Password Failure**: Incorrect passwords trigger account lockout after 5 consecutive failed attempts (15-minute lock).
- **Weak PIN Filter**: Rejects trivially weak or sequential PINs (`000000`, `123456`, `654321`, `111111`, etc.) with HTTP 422 `PIN_TOO_WEAK`.
- **One-Time Creation**: Once a PIN is set, subsequent calls to `POST /api/wallet/pin` are rejected with HTTP 409 `PIN_ALREADY_SET`.

### 2.3 Rate Limiting & Lockout Policy
- Maximum consecutive failed attempts: **5 attempts**.
- Lockout duration: **15 minutes** (`pinLockedUntil`).
- Successful PIN verification resets `pinFailedAttempts` to `0` and clears `pinLockedUntil`.
- Security audit logs record failed attempts and lockout events (`PIN_ATTEMPT_FAILED`, `PIN_LOCKED`) with masked context.

---

## 3. Server-Authoritative Wallet Read Model (Phase 4B Task 4B.1 & 4B.2)

### 3.1 Endpoint Contract: `GET /api/wallet`
The wallet dashboard hydrates directly from `GET /api/wallet`.

#### Request
- **Method**: `GET`
- **Authentication**: Valid session cookie (`validateAuthoritativeSession()`).

#### Response DTO (200 OK)
```json
{
  "wallet": {
    "activeBalance": 5000000,
    "heldBalance": 1200000
  },
  "security": {
    "hasPin": true
  },
  "bankAccounts": [
    {
      "id": "c7a8b9d0-1234-5678-90ab-cdef12345678",
      "bankCode": "BCA",
      "bankName": "Bank Central Asia",
      "accountHolder": "Budi Pratama",
      "accountNumberMasked": "•••• •••• 7890",
      "isDefault": true
    }
  ],
  "ledgerEntries": [
    {
      "id": "e1f2a3b4-5678-90ab-cdef-1234567890ab",
      "type": "WITHDRAWAL",
      "direction": "DEBIT",
      "amount": 500000,
      "balanceAfter": 5000000,
      "referenceType": "WITHDRAWAL",
      "referenceId": "wd-uuid-1234",
      "description": "Penarikan saldo ke Bank Central Asia (7890) [Simulasi Transfer]",
      "createdAt": "2026-10-02T12:00:00.000Z"
    }
  ]
}
```

### 3.2 Elimination of Client Financial State
- `useWalletStore` no longer uses Zustand `persist` middleware.
- Financial balances (`saldoAktif`, `saldoTertahan`, `transactions`) are initialized to neutral state and populated solely by `fetchWallet()`.
- Client-side fake actions (`releaseEscrowToWallet`, `holdEscrowFunds`) have been deleted.
- Page reload reconstructs state from PostgreSQL without client-side state fabrication.

---

## 4. Payout Destination Integrity & IDOR Defense (Phase 4B Task 4B.4 & 4B.5)

### 4.1 Canonical Input Elimination
Client-submitted `bankName`, `accountNumber`, and `accountHolder` are completely eliminated as authoritative input.
The client submits:
```json
{
  "amount": 500000,
  "bankAccountId": "c7a8b9d0-1234-5678-90ab-cdef12345678",
  "pin": "741852"
}
```
with HTTP Header:
```http
Idempotency-Key: f47ac10b-58cc-4372-a567-0e02b2c3d479
```

### 4.2 Database Ownership Resolution
In `WalletLedgerService.requestWithdrawal`:
```typescript
const bankAccount = await prisma.bankAccount.findFirst({
  where: {
    id: bankAccountId,
    userId: session.id, // Strictly scoped to authenticated user
  },
});

if (!bankAccount) {
  throw new WalletDomainError(
    "BANK_ACCOUNT_NOT_FOUND",
    "Rekening tujuan penarikan tidak ditemukan atau bukan milik akun Anda."
  );
}
```

### 4.3 IDOR Invariant
- If User A submits a `bankAccountId` belonging to User B:
  - Query returns `null`.
  - HTTP 404 `BANK_ACCOUNT_NOT_FOUND` is returned.
  - Zero database mutations occur (balances, withdrawal records, and ledger records remain unchanged).
  - No details regarding User B's account existence or bank details are leaked.

---

## 5. Withdrawal Idempotency & Ambiguous Network Outcomes (Task 4B.6 & 4B.7)

### 5.1 Idempotency Key Handling
1. The client generates a UUID for each logical withdrawal attempt and transmits it in the `Idempotency-Key` header.
2. The domain service checks for an existing `Withdrawal` matching `idempotencyKey`.
3. If an existing record is found, the server immediately returns the canonical cached outcome with `isDuplicate: true`, avoiding a duplicate debit.

### 5.2 Ambiguous State Handling
- In the event of a client network failure or timeout during `POST /api/wallet/withdraw`, the UI flags the operation as `UNKNOWN / PENDING`.
- The client retains the generated `Idempotency-Key`.
- The client triggers `fetchWallet()` to reconcile state against canonical server records.
- Balances are never adjusted speculatively client-side.

---

## 6. Secret Sanitization Audit (Task 4B.10)

All wallet endpoints are protected against credential and secret leakage. The following attributes are strictly banned from API outputs and verified via automated test assertions:
- `hashedPin`
- `hashedPassword`
- `totpSecret*` (ciphertext, iv, tag, keyVersion)
- `pinFailedAttempts`
- `pinLockedUntil`
- `sessionVersion`
- Unmasked `accountNumber` (in read APIs)
- Cryptographic keys and secrets (`AUTH_SECRET`, `TOTP_ENCRYPTION_KEY`, etc.)

---

## 7. Product Truthfulness & Regulatory Claims (Task 4B.9)

### 7.1 Corrections Applied
- Replaced misleading claims of "Garansi 100% Aman", "Kustodian BI Terdaftar", "BI-FAST 24/7", and "KYC Match" with truthful terminology:
  - "Proteksi rekening bersama platform"
  - "Pencairan dana simulasi demo"
  - "Rekening bank terdaftar"
  - "Verifikasi e-KYC simulasi"
- All payout processes are explicitly designated as demo transfer simulations until formal commercial banking integrations are completed.
