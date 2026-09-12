# NgeBekasinYuk Deployment & Infrastructure Runbook

## 1. Environment Profiles

### 1.1 Local Development Mode (Zero-Dependency)
- **Database**: SQLite (`apps/web/dev.db`)
- **Providers**: `DemoPaymentProvider`, `DemoKycProvider`, `DemoWithdrawalProvider`
- **Setup Command**:
  ```bash
  pnpm install
  pnpm --filter web exec prisma db push
  pnpm --filter web run db:seed
  pnpm --filter web dev
  ```

### 1.2 Staging / Production Candidate Mode
- **Database**: PostgreSQL 16+ (Docker or Managed Cloud PostgreSQL e.g. Neon / Supabase / AWS RDS)
- **Connection String**:
  ```env
  DATABASE_URL="postgresql://user:password@host:5432/ngebekasinyuk?schema=public"
  ```
- **Migration & Client Generation**:
  ```bash
  npx prisma migrate deploy
  npx prisma generate
  ```

---

## 2. Docker Compose (Production Staging)

A `docker-compose.yml` can spin up the full production stack:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: ngebekasin-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: production_secret_password
      POSTGRES_DB: ngebekasinyuk
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## 3. Required Production Secrets

Before deploying to production, ensure these environment variables are set securely and never committed to version control:
- `AUTH_SECRET`: Random 32+ character key (`openssl rand -base64 32`).
- `ADMIN_STEP_UP_SECRET`: Random 32+ character key for 2FA grants.
- `DATABASE_URL`: PostgreSQL connection string with SSL enabled.
- `SESSION_COOKIE_NAME`: Session cookie name (e.g. `__Secure-ngebekasin_session`).
- `DEMO_PAYMENT_PROVIDER`: Set to `false` when real payment gateway (e.g. Midtrans / Xendit) credentials are configured.
- `DEMO_WITHDRAWAL_PROVIDER`: Set to `false` when real disbursement API (e.g. BI-FAST partner) credentials are configured.
