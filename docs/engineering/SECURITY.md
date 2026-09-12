# NgeBekasinYuk Application Security & Defense-in-Depth Specification
### Hardening Pass #3 Final Production Candidate Certification Standards

## 1. Threat Model & Security Architecture

NgeBekasinYuk is a C2C tech marketplace handling high-value gadget transactions with an escrow mechanism. The security architecture addresses the following critical threat vectors:
1. **Privilege Escalation via Session Tampering & Stale Privilege Retention**: Attackers forging cookies or relying on cryptographically valid tokens after administrative role downgrade or password reset (`HP2-P0-01`, `HP3-P0-01`).
2. **Distributed Replay Attacks on TOTP Authentication**: Attackers replaying valid 6-digit OTP codes against multiple server instances or after process restarts (`HP3-P0-02`).
3. **Reversible Credential Exposure at Rest**: Plaintext storage of administrative TOTP seeds in the database (`HP3-P0-03`).
4. **Step-Up Token Re-use Across High-Risk Actions**: Admin step-up grants reused multiple times across different disputes within their validity window (`HP3-P0-04`).
5. **Production Startup with Insecure Defaults or Demo Leakage**: Deployments booting with hardcoded development secrets or simulator endpoints exposed in live environments (`HP2-P0-02`, `HP3-P1-03`).
6. **Financial Double-Spend & Concurrency Races**: Parallel requests executing simultaneous escrow releases or overdrafting wallet balances (`HP2-P0-04`, `HP2-P0-05`).
7. **Insecure Direct Object Reference (IDOR)**: Users manipulating order, listing, or dispute identifiers to view or mutate unauthorized records.
8. **Cross-Site Request Forgery (CSRF) & Clickjacking**: Unauthorized state changes executed via forged cross-origin requests or frame embedding.

---

## 2. Authentication & Dual-Layer Session Architecture

### 2.1 Coarse-Grained Routing Guard: Next.js Proxy (`src/proxy.ts`)
- **Web Crypto HMAC-SHA256**: All session tokens (`payload.signature`) are signed using SHA-256 HMAC.
- **Fail-Closed Route Gate**: The Next.js Edge-compatible proxy verifies cryptographic signatures before inspecting payload claims. Forged or tampered tokens are rejected immediately.
- **Constant-Time Verification**: Bitwise comparison eliminates timing side-channel attacks.
- **Framework Native**: Migrated from deprecated middleware to `src/proxy.ts` (`export default function proxy(req)`), eliminating framework deprecation warnings while preserving route matching and security headers.

### 2.2 Fine-Grained Authoritative Database Validation (`HP3-P0-01`)
High-risk mutating endpoints (`/api/admin/step-up`, `/api/disputes/[id]/verdict`, `/api/orders/[id]/transition`, `/api/wallet/withdraw`) do NOT rely solely on client tokens. They execute authoritative database validation via `validateAuthoritativeSession()`:
1. Lookup user in PostgreSQL by `session.id`.
2. Verify `user.accountStatus === "ACTIVE"` (rejects `SUSPENDED` or `DISABLED` accounts).
3. Verify `token.sessionVersion === user.sessionVersion` (rejects stale tokens).
4. Authorize action based on current database role (`user.role`), preventing stale admin privileges from surviving role downgrades.

### 2.3 Centralized Session Invalidation
Security-critical operations invoke `revokeUserSessions(userId, reason)`:
- Password changes and resets
- Role changes and administrative privilege revocation
- Account suspensions or disabling
- TOTP secret resets
- Suspicious activity / forced logouts
Every revocation increments `user.sessionVersion` in PostgreSQL and records an immutable audit log entry.

---

## 3. Distributed RFC 6238 TOTP Replay Defense (`HP3-P0-02`)

### 3.1 Persistent Timestep State in PostgreSQL
- **Algorithm**: Standard RFC 6238 Time-Based One-Time Password with HMAC-SHA1 and 30-second timesteps.
- **Persistent State**: The `User` model persists `lastTotpStep Int?`.
- **Atomic Conditional Mutation**: Upon verifying a submitted code, the matched timestep is recorded using an atomic conditional update:
  ```prisma
  await prisma.user.updateMany({
    where: {
      id: adminId,
      accountStatus: "ACTIVE",
      OR: [
        { lastTotpStep: null },
        { lastTotpStep: { lt: matchedStep } }
      ]
    },
    data: { lastTotpStep: matchedStep }
  })
  ```
- **Distributed Invariant**: If two concurrent requests on separate instances or workers submit the exact same TOTP code, exactly one update succeeds (`count === 1`); the other fails and is blocked as `REPLAY_ATTEMPT`. Server restarts do not reset replay protection.

---

## 4. Application-Layer Secret Encryption-at-Rest (`HP3-P0-03`)

### 4.1 AEAD Cryptography (AES-256-GCM)
Administrative TOTP secrets are reversible credentials and cannot be hashed. They are encrypted at rest using AES-256-GCM:
- **Module**: `src/lib/security/encryption.ts` using native Node.js `crypto`.
- **Cipher**: `aes-256-gcm` with 256-bit key entropy, 96-bit (12-byte) unique random IV per encryption, and 128-bit (16-byte) authentication tag.
- **Database Schema**:
  ```prisma
  totpSecretCiphertext String?
  totpSecretIv         String?
  totpSecretTag        String?
  totpSecretKeyVersion Int?    @default(1)
  ```
- **Integrity**: Any modification to ciphertext or authentication tag fails decryption immediately.
- **Key Rotation Architecture**: Envelope includes `keyVersion`. Supports phased key rotation by retaining previous key version while re-encrypting records upon access. In cloud production, integration with AWS KMS or Google Cloud KMS is recommended.

---

## 5. Single-Use Admin Step-Up Authorization Grants (`HP3-P0-04`)

### 5.1 One-Time Grant Persistence
- **Model**: `AdminStepUpGrant` in PostgreSQL stores `id`, `adminId`, `action`, `resourceId`, `expiresAt`, `consumedAt`.
- **Grant Token**: Contains `{ grantId, adminId, action, resourceId, expiresAt }` signed with `ADMIN_STEP_UP_SECRET`.
- **Atomic Consumption**:
  ```prisma
  await prisma.adminStepUpGrant.updateMany({
    where: {
      id: payload.grantId,
      adminId: expectedAdminId,
      action: expectedAction,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      OR: [{ resourceId: null }, { resourceId: expectedResourceId }]
    },
    data: { consumedAt: new Date() }
  })
  ```
- **Single-Use Invariant**: Exactly one execution is permitted per challenge grant. Subsequent attempts with the same token are rejected (`INVALID_STEP_UP_CODE`).
- **Resource Scope Binding**: A grant issued for `DISPUTE_VERDICT:DSP-001` cannot be presented to resolve `DSP-002`.

---

## 6. Environment Separation & Fail-Closed Safety (`HP3-P1-03`)

The application defines distinct deployment environments via `APP_ENV`:

| Environment | Mode | Demo Simulators | Sandbox Override | Development Keys Allowed |
|---|---|---|---|---|
| `development` | Local Dev | Allowed | Optional | Allowed |
| `test` | Automated CI | Allowed | Optional | Allowed |
| `staging` | Staging QA | Prohibited by default | Allowed only if `SANDBOX_MODE=true` | Prohibited in production build |
| `production` | Live Production | Strictly Prohibited | Prohibited | Strictly Prohibited |

- **No Production Override**: In `APP_ENV === "production"`, `ALLOW_DEMO_IN_PRODUCTION` has no effect. Any demo simulator flag triggers immediate startup crash.
- **Simulator Endpoints**: `/api/payment/simulate-webhook` returns `404 Not Found` in production.

---

## 7. Financial Concurrency & Idempotency Controls

- **Escrow Mutation**: Escrow release and refund operations execute conditional database updates (`where: { isReleased: false, isRefunded: false }`). If row count is 0, transaction aborts.
- **Wallet Overdraft Defense**: Wallet withdrawals execute conditional decrements (`where: { activeBalance: { gte: amount } }`).
- **Idempotency Keys**: Financial operations generate deterministic idempotency keys (`SHA-256(action:resourceId:scope)`), preventing duplicate payouts or webhook replays.

---

## 8. Security Headers & Defense-in-Depth

Configured natively via Next.js Proxy (`src/proxy.ts`):
- `Content-Security-Policy`: Restricts scripts, styles, objects, and framing.
- `X-Frame-Options: DENY`: Complete clickjacking mitigation.
- `X-Content-Type-Options: nosniff`: Prevents MIME-type confusion attacks.
- `Referrer-Policy: strict-origin-when-cross-origin`: Controls referrer leakage.
- `Permissions-Policy`: Restricts unneeded device capabilities (camera, microphone, geolocation).

---

## 9. Immutable Audit Logging

- `AuditLog` records are strictly append-only; no APIs support mutation or deletion.
- Captures `userId`, `action`, `targetType`, `targetId`, `ipAddress`, `userAgent`, and sanitized JSON `details`.
- Sensitive credentials (`password`, `pin`, `AUTH_SECRET`, `totpSecret`, `stepUpCode`, encryption keys) are scrubbed before persistence. Bank accounts are masked.
