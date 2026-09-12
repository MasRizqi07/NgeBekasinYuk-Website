# NgeBekasinYuk Production Candidate Deployment & Operations Runbook

## 1. Environment Profiles

### 1.1 Development / Local Integration Mode
- **Database**: PostgreSQL 16+ running locally on port 5432 / 5433 or via Docker Compose.
- **Providers**: `DemoPaymentProvider`, `DemoKycProvider`, `DemoWithdrawalProvider` enabled.
- **Execution**:
  ```bash
  pnpm install --frozen-lockfile
  pnpm --filter web exec prisma migrate deploy
  pnpm --filter web run db:seed
  pnpm --filter web dev
  ```

### 1.2 Staging / Production Candidate Mode
- **Database**: Managed PostgreSQL 16+ (AWS RDS, Supabase, Neon, or self-hosted container).
- **Connection String**:
  ```env
  DATABASE_URL="postgresql://user:password@host:5432/ngebekasinyuk?schema=public&sslmode=require"
  ```
- **Migration Execution**:
  ```bash
  pnpm --filter web run prisma:generate
  pnpm --filter web exec prisma migrate deploy
  pnpm --filter web exec prisma migrate status
  ```

---

## 2. Docker Compose Staging Configuration

A standard `docker-compose.yml` is provided in the repository root for reproducible staging:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: ngebekasinyuk_postgres
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: production_strong_password
      POSTGRES_DB: ngebekasinyuk_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: ngebekasinyuk_redis
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
```

---

## 3. Mandatory Production Secrets & Fail-Closed Validation

The application validates all configuration at boot via `src/lib/env.ts`. Production will immediately refuse to start if any of the following requirements are not met:

| Variable | Requirement | Description |
|---|---|---|
| `NODE_ENV` | `"production"` | Activates strict security validations and CSP enforcement |
| `DATABASE_URL` | Valid PostgreSQL URI | Must begin with `postgresql://` or `postgres://` |
| `AUTH_SECRET` | 32+ characters | Server-side cryptographic HMAC-SHA256 session signing key |
| `ADMIN_STEP_UP_SECRET` | 32+ characters | Server-side signing secret for 5-minute RFC 6238 TOTP step-up grants |
| `ADMIN_STEP_UP_TTL_SECONDS` | `300` | Expiration window for verified admin verdict grants |
| `SESSION_COOKIE_NAME` | String | Cookie identifier (e.g. `__Secure-ngebekasinyuk_session`) |
| `ALLOW_DEMO_IN_PRODUCTION` | `"false"` | Prohibits simulated payment and withdrawal providers in live environments |

---

## 4. PostgreSQL Backup & Disaster Recovery Runbook

### 4.1 Automated Backup Policy
1. **Daily Full Backups**: Automated daily snapshot taken via `pg_dump` or cloud provider managed snapshots (AWS RDS / Supabase).
2. **Point-in-Time Recovery (PITR)**: Write-Ahead Logging (WAL) archiving enabled with a minimum 7-day retention window.
3. **Encryption at Rest**: Backup artifacts encrypted using AES-256 (KMS-managed keys).

### 4.2 Backup Restoration Verification Procedure
Before promoting any release to production live, test backup restoration on a clean integration database:
```bash
# 1. Create a clean test restoration target
createdb -h localhost -U postgres ngebekasinyuk_restore_test

# 2. Restore from snapshot
pg_restore -h localhost -U postgres -d ngebekasinyuk_restore_test backup_snapshot.dump

# 3. Verify migration status and table counts
DATABASE_URL="postgresql://postgres:password@localhost:5432/ngebekasinyuk_restore_test" \
  pnpm --filter web exec prisma migrate status
```

---

## 5. Security & Network Hardening

1. **HTTPS Enforcement**: Reverse proxy (Nginx, Cloudflare, AWS ALB) must enforce TLS 1.3 and terminate HTTPS.
2. **Secure Cookies**: In production, session cookies enforce `Secure; HttpOnly; SameSite=Lax`.
3. **Content Security Policy**: Configured in Next.js middleware to restrict script execution, inline injections, and framing.
4. **Health Check Endpoints**: Monitor container liveness and database connection status via standard load balancer probes.
