# NgeBekasinYuk Production Candidate Deployment & Operations Runbook
### Hardening Pass #3 Production Candidate Standards

## 1. Environment Profiles & Deployment Matrix

The application defines distinct deployment operational semantics via `APP_ENV` (HP3-P1-03):

| Environment (`APP_ENV`) | `NODE_ENV` | Target Use Case | Demo Providers | Sandbox Override | Key Fallback Allowed |
|---|---|---|---|---|---|
| `development` | `development` | Local workstation development | Allowed | Optional | Yes |
| `test` | `test` | Automated CI pipeline & test runners | Allowed | Optional | Yes |
| `staging` | `production` | QA, staging, and pre-production certification | Prohibited | Allowed only with `SANDBOX_MODE=true` | Prohibited |
| `production` | `production` | Live production customer environment | **Strictly Prohibited** | **Prohibited** | **Strictly Prohibited** |

---

## 2. Mandatory Production Configuration & Fail-Closed Validation

The centralized validation module (`src/lib/env.ts`) evaluates configuration at startup. Production crashes immediately if any invariant fails:

| Variable | Type / Constraints | Description |
|---|---|---|
| `APP_ENV` | `enum("development", "test", "staging", "production")` | Explicit deployment tier |
| `NODE_ENV` | `enum("development", "test", "production")` | Framework optimization mode |
| `DATABASE_URL` | PostgreSQL URI (`postgresql://...`) | Must point to PostgreSQL 16+ target |
| `AUTH_SECRET` | 32+ chars, non-fallback | Cryptographic HMAC-SHA256 session signing key |
| `ADMIN_STEP_UP_SECRET` | 32+ chars, non-fallback | Signing key for single-use step-up authorization grants |
| `ADMIN_STEP_UP_TTL_SECONDS` | Number (default `300`) | Validity window for admin challenge grants |
| `TOTP_ENCRYPTION_KEY` | Min 32 bytes (CSPRNG Base64 recommended) | Derives 256-bit AES-256-GCM encryption key material via SHA-256 |
| `SESSION_COOKIE_NAME` | String | Cookie identifier (e.g. `ngebekasinyuk_session`) |
| `DEMO_PAYMENT_PROVIDER` | Boolean | Must be `false` in `APP_ENV=production` |
| `DEMO_KYC_PROVIDER` | Boolean | Must be `false` in `APP_ENV=production` |
| `DEMO_WITHDRAWAL_PROVIDER` | Boolean | Must be `false` in `APP_ENV=production` |
| `SANDBOX_MODE` | Boolean | Enables simulator providers only when `APP_ENV=staging` |
| `ALLOW_DEMO_IN_PRODUCTION` | Boolean | Cannot override safety when `APP_ENV=production` |

---

## 3. Database Migration Runbook

All database changes are managed through forward Prisma migrations:

### Migration History:
1. `20260912073944_init`: Base PostgreSQL relational schema (users, orders, escrow, wallet, disputes, audit log).
2. `20260912083315_pass_3_security_hardening`: Added `accountStatus`, `lastTotpStep`, encrypted TOTP secret fields (`totpSecretCiphertext`, `totpSecretIv`, `totpSecretTag`, `totpSecretKeyVersion`), and `AdminStepUpGrant` table.
3. `20260913020000_drop_plaintext_totp_secret`: Dropped legacy plaintext `totpSecret` column to strictly enforce zero plaintext credentials at rest (`AP4-P0-01`, `AP4-P0-02`).

### 3.1 Fresh Database Deployment (Greenfield / CI):
```bash
# 1. Validate Prisma schema
pnpm --filter web exec prisma validate

# 2. Generate typed client
pnpm --filter web run prisma:generate

# 3. Apply all pending forward migrations
pnpm --filter web run db:migrate:deploy

# 4. Verify migration status
pnpm --filter web run db:migrate:status
```

### 3.2 Upgrading Existing Production Databases (Pass #2 → Pass #3 Final Schema):
> [!CAUTION]
> **CRITICAL DATA PRESERVATION PROTOCOL (`FINAL-OPS-01`)**
> Migration `20260913020000_drop_plaintext_totp_secret` issues `ALTER TABLE "User" DROP COLUMN "totpSecret";`.
> You **MUST NOT** apply forward migrations past migration #2 until the legacy TOTP encryption backfill and preflight verification have succeeded!

Follow this strict 8-step deployment sequence:

```bash
# Step 1: Database backup
pg_dump "$DATABASE_URL" -Fc -f "ngebekasinyuk_pre_upgrade_$(date +%Y%m%d_%H%M%S).dump"

# Step 2: Confirm schema is up to date through migration #2
pnpm --filter web exec prisma migrate status
# Ensure 20260912083315_pass_3_security_hardening is applied

# Step 3: Run the TOTP encryption backfill script
# Scans all records with plaintext totpSecret and generates AES-256-GCM encrypted envelopes
pnpm --filter web run db:migrate-totp-secrets

# Step 4: Run preflight verification check
# Fails with exit code 1 if COUNT(users with plaintext TOTP and no ciphertext) > 0
pnpm --filter web run db:verify-totp-migration

# Step 5: Abort deployment if Step 3 or Step 4 reported any errors (non-zero exit code).
# Do NOT proceed to Step 6 if any plaintext seeds remain unencrypted.

# Step 6: Apply migration #3 (DROP COLUMN "totpSecret")
pnpm --filter web run db:migrate:deploy

# Step 7: Verify migration status & envelopes
pnpm --filter web run db:migrate:status
pnpm --filter web run db:verify-totp-migration

# Step 8: Run smoke test for admin TOTP authentication and dispute step-up authorization
pnpm --filter web run test -- test/integration/adminStepUpTotp.test.ts
```

---

## 4. Key Management & Key Rotation Architecture

### 4.1 Candidate Stage Architecture
In candidate stage, `TOTP_ENCRYPTION_KEY` is loaded from a secure environment variable (fail-closed, minimum 32 bytes, no development fallback in production). AES-256 key material is derived via SHA-256 to guarantee a 256-bit key width. For production, generating 32 cryptographically secure random bytes (e.g. `crypto.randomBytes(32).toString('base64')`) is mandated.

### 4.2 Production Key Rotation Strategy
Every encrypted payload persists `totpSecretKeyVersion Int? @default(1)`.
When rotating encryption keys:
1. Introduce new key as active (`keyVersion = 2`) while retaining previous key version (`keyVersion = 1`) as decryption-only fallback.
2. Encrypt all newly enrolled or updated TOTP secrets with the new key version.
3. Decrypt existing secrets using their respective `keyVersion` and lazily re-encrypt them with `keyVersion = 2` upon successful verification.
4. Retire the old key once all records have been migrated.
5. In live cloud production, direct integration with AWS KMS or Google Cloud KMS envelope encryption is strongly recommended.

---

## 5. Security & Network Hardening

1. **HTTPS Enforcement**: Reverse proxy (Cloudflare, Nginx, AWS ALB) must enforce TLS 1.3 and terminate HTTPS.
2. **Next.js Proxy Security Headers**: Configured in `src/proxy.ts`:
   - `Content-Security-Policy`: Restricts inline injections, external script sources, and frame embedding.
   - `X-Frame-Options: DENY`: Prevents clickjacking.
   - `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
   - `Referrer-Policy: strict-origin-when-cross-origin`.
3. **Cookie Attributes**: In production, `HttpOnly; SameSite=Lax; Secure` flags are strictly enforced.
4. **Simulator Endpoints**: `/api/payment/simulate-webhook` and development admin tools return `404 Not Found` in production.
