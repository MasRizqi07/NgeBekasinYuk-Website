// Production Environment Configuration Fail-Closed Tests (HP2-P0-02)
import { describe, it, expect } from "vitest";
import { parseEnv } from "@/lib/env";

describe("Production Environment Validation Tests", () => {
  const validProductionEnv = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://postgres:securepassword@prod-db.internal:5432/ngebekasinyuk_prod?schema=public",
    AUTH_SECRET: "c0mplex-prod-auth-secret-min-32-characters-long!",
    ADMIN_STEP_UP_SECRET: "c0mplex-prod-stepup-secret-min-32-characters-long!",
    SESSION_COOKIE_NAME: "ngebekasinyuk_session",
    ADMIN_STEP_UP_TTL_SECONDS: "300",
    DEMO_PAYMENT_PROVIDER: "false",
    DEMO_KYC_PROVIDER: "false",
    DEMO_WITHDRAWAL_PROVIDER: "false",
    ALLOW_DEMO_IN_PRODUCTION: "false",
    NEXT_PUBLIC_APP_URL: "https://ngebekasinyuk.id",
  };

  it("passes when valid production configuration is provided", () => {
    const config = parseEnv(validProductionEnv);
    expect(config.NODE_ENV).toBe("production");
    expect(config.AUTH_SECRET).toBe(validProductionEnv.AUTH_SECRET);
    expect(config.DATABASE_URL.startsWith("postgresql://")).toBe(true);
  });

  it("FAILS STARTUP if AUTH_SECRET is missing in production", () => {
    const env = { ...validProductionEnv, AUTH_SECRET: "" };
    expect(() => parseEnv(env)).toThrow(/AUTH_SECRET/);
  });

  it("FAILS STARTUP if AUTH_SECRET is shorter than 32 characters in production", () => {
    const env = { ...validProductionEnv, AUTH_SECRET: "short-secret" };
    expect(() => parseEnv(env)).toThrow(/AUTH_SECRET.*at least 32/);
  });

  it("FAILS STARTUP if AUTH_SECRET uses the development fallback secret in production", () => {
    const env = {
      ...validProductionEnv,
      AUTH_SECRET: "dev-secret-change-in-production-min-32-chars-key",
    };
    expect(() => parseEnv(env)).toThrow(/cannot use the development fallback secret/);
  });

  it("FAILS STARTUP if DATABASE_URL is SQLite in production", () => {
    const env = { ...validProductionEnv, DATABASE_URL: "file:./prod.db" };
    expect(() => parseEnv(env)).toThrow(/must be a PostgreSQL connection string/);
  });

  it("FAILS STARTUP if demo providers are enabled in production without explicit sandbox override", () => {
    const envWithDemo = {
      ...validProductionEnv,
      DEMO_PAYMENT_PROVIDER: "true",
      ALLOW_DEMO_IN_PRODUCTION: "false",
    };
    expect(() => parseEnv(envWithDemo)).toThrow(/Demo simulation providers are prohibited in production/);
  });

  it("allows development defaults when NODE_ENV !== production", () => {
    const devEnv = {
      NODE_ENV: "development",
    };
    const config = parseEnv(devEnv);
    expect(config.NODE_ENV).toBe("development");
    expect(config.DATABASE_URL).toBe("file:./dev.db");
  });
});
