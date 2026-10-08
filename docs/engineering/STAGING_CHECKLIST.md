# Staging Validation & Production Readiness Checklist

**Status:** READY FOR OPERATIONAL EXECUTION (Owner Action Items)  
**Target Environment:** Staging / Production Pre-Flight  
**Requirement Reference:** Master Prompt Phase 6  

Every operational verification gate below must be executed by the repository owner (`MasRizqi07`). Each gate contains an evidentiary slot initially designated as `NOT RUN`.

---

## 1. Staging Deploy with Production-Grade PostgreSQL

- **Objective:** Deploy application container/service against managed PostgreSQL (version 16+) with SSL enforcement (`sslmode=require`), connection pooling (PgBouncer or Supabase transaction pooler), and production-grade environment variables (`APP_ENV=staging`, `SANDBOX_MODE=true`).
- **Owner Action:** Execute deployment to staging host/cluster, verify database migrations apply cleanly via `prisma migrate deploy`, and verify application health check.
- **Evidence Slot:**
  ```text
  [PASTE RAW EVIDENCE HERE]
  Status: NOT RUN
  ```

---

## 2. Provider Sandbox Validation (Payment & Courier)

- **Objective:** Validate live HTTP integrations with third-party payment gateways (e.g. Midtrans Sandbox / Xendit Sandbox) and courier logistics APIs (e.g. Biteship / RajaOngkir Sandbox).
- **Owner Action:**
  1. Trigger sandboxed Virtual Account / QRIS creation and verify notification callback signature verification.
  2. Query courier rate calculation and sandbox airway bill tracking.
- **Evidence Slot:**
  ```text
  [PASTE RAW EVIDENCE HERE]
  Status: NOT RUN
  ```

---

## 3. Observability & Telemetry (Logs & Error Tracking)

- **Objective:** Ensure structured JSON logging, distributed request tracing (W3C Trace Context / correlation IDs), and real-time error reporting (Sentry / Baselime / Datadog) are active and functional without leaking sensitive credentials or PII.
- **Owner Action:** Trigger a test unhandled route error and inspect dashboard to verify stack trace capture with redacted auth cookies/secrets.
- **Evidence Slot:**
  ```text
  [PASTE RAW EVIDENCE HERE]
  Status: NOT RUN
  ```

---

## 4. Disaster Recovery & Backup / Restore Drill

- **Objective:** Verify database point-in-time recovery (PITR) and automated snapshot restoration without data corruption.
- **Owner Action:**
  1. Create manual snapshot of staging database containing seed and test order transactions.
  2. Restore snapshot to an isolated verification database instance.
  3. Verify row counts and foreign key integrity across `Order`, `EscrowLedgerEntry`, and `Wallet`.
- **Evidence Slot:**
  ```text
  [PASTE RAW EVIDENCE HERE]
  Status: NOT RUN
  ```

---

## 5. Migration Rehearsal on Legacy Data Copy

- **Objective:** Rehearse forward database schema migrations against an obfuscated copy of realistic existing data.
- **Owner Action:**
  1. Restore legacy database dump with pre-existing orders and default PINs.
  2. Execute `prisma migrate deploy` and `pnpm --filter web run db:migrate-default-pins`.
  3. Verify zero schema lock contention or aborted transactions.
- **Evidence Slot:**
  ```text
  [PASTE RAW EVIDENCE HERE]
  Status: NOT RUN
  ```

---

## 6. Secrets Rotation Rehearsal

- **Objective:** Verify zero downtime and predictable session behavior during key rotation drills.
- **Owner Action:**
  1. Rotate `AUTH_SECRET` and `ADMIN_STEP_UP_SECRET`.
  2. Verify active user sessions are securely invalidated and redirected to `/login`.
  3. Re-authenticate and verify new session token signing and verification.
- **Evidence Slot:**
  ```text
  [PASTE RAW EVIDENCE HERE]
  Status: NOT RUN
  ```

---

## 7. Load & Concurrency Stress Test

- **Objective:** Stress test `POST /api/orders` (order creation with listing reservation) and `POST /api/payment/simulate-webhook` under concurrent load.
- **Owner Action:**
  1. Run `k6` or `autocannon` targeting order creation endpoint with 50 concurrent virtual users.
  2. Assert that simultaneous order attempts on the same listing yield exactly 1 success (`201`) and concurrent attempts return `422 LISTING_NOT_ACTIVE`.
  3. Verify zero deadlocks in PostgreSQL transaction logs.
- **Evidence Slot:**
  ```text
  [PASTE RAW EVIDENCE HERE]
  Status: NOT RUN
  ```

---

## 8. User Acceptance Testing (UAT)

- **Objective:** End-to-end human walkthrough of buyer journey, seller order fulfillment, and admin dispute resolution.
- **Owner Action:**
  1. Complete buyer registration, checkout, payment, inspection, and completion.
  2. Complete seller listing, withdrawal to registered bank account with transaction PIN.
  3. Simulate dispute escalation and admin TOTP step-up verdict execution.
- **Evidence Slot:**
  ```text
  [PASTE RAW EVIDENCE HERE]
  Status: NOT RUN
  ```

---

## 9. Canary Launch & Traffic Ramp

- **Objective:** Progressive traffic routing to production candidate build.
- **Owner Action:**
  1. Route 5% of production traffic to canary release.
  2. Monitor error rates, transaction completion rates, and p95 response latencies for 2 hours.
  3. Ramp traffic to 25%, 50%, and 100%.
- **Evidence Slot:**
  ```text
  [PASTE RAW EVIDENCE HERE]
  Status: NOT RUN
  ```
