import { describe, it, expect } from "vitest";
import { parseEnv, DEV_AUTH_FALLBACK, DEV_ADMIN_STEP_UP_FALLBACK, DEV_TOTP_ENCRYPTION_KEY_FALLBACK } from "../../src/lib/env";

describe("Strict Deployment Environment Semantics & Demo Guard (HP3-P1-03)", () => {
  const validProductionSecrets = {
    AUTH_SECRET: "strong-production-auth-secret-32-chars-long",
    ADMIN_STEP_UP_SECRET: "strong-production-admin-step-up-32-chars-long",
    TOTP_ENCRYPTION_KEY: "strong-production-totp-key-32-chars-long",
    DATABASE_URL: "postgresql://postgres:pass@localhost:5432/prod_db?schema=public",
  };

  it("allows demo providers in APP_ENV=development", () => {
    const env = parseEnv({
      NODE_ENV: "development",
      APP_ENV: "development",
      DEMO_PAYMENT_PROVIDER: "true",
      DEMO_KYC_PROVIDER: "true",
      DEMO_WITHDRAWAL_PROVIDER: "true",
    });

    expect(env.APP_ENV).toBe("development");
    expect(env.DEMO_PAYMENT_PROVIDER).toBe(true);
  });

  it("allows demo providers in APP_ENV=test", () => {
    const env = parseEnv({
      NODE_ENV: "test",
      APP_ENV: "test",
      DEMO_PAYMENT_PROVIDER: "true",
      DEMO_KYC_PROVIDER: "true",
      DEMO_WITHDRAWAL_PROVIDER: "true",
    });

    expect(env.APP_ENV).toBe("test");
    expect(env.DEMO_PAYMENT_PROVIDER).toBe(true);
  });

  it("allows staging environment when demo providers are disabled", () => {
    const env = parseEnv({
      NODE_ENV: "production",
      APP_ENV: "staging",
      ...validProductionSecrets,
      DEMO_PAYMENT_PROVIDER: "false",
      DEMO_KYC_PROVIDER: "false",
      DEMO_WITHDRAWAL_PROVIDER: "false",
      SANDBOX_MODE: "false",
    });

    expect(env.APP_ENV).toBe("staging");
    expect(env.DEMO_PAYMENT_PROVIDER).toBe(false);
  });

  it("rejects staging environment with demo providers when SANDBOX_MODE is false", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        APP_ENV: "staging",
        ...validProductionSecrets,
        DEMO_PAYMENT_PROVIDER: "true",
        SANDBOX_MODE: "false",
      })
    ).toThrow(/Demo simulation providers in staging require SANDBOX_MODE=true/);
  });

  it("allows staging environment with demo providers when SANDBOX_MODE=true", () => {
    const env = parseEnv({
      NODE_ENV: "production",
      APP_ENV: "staging",
      ...validProductionSecrets,
      DEMO_PAYMENT_PROVIDER: "true",
      DEMO_KYC_PROVIDER: "true",
      DEMO_WITHDRAWAL_PROVIDER: "true",
      SANDBOX_MODE: "true",
    });

    expect(env.APP_ENV).toBe("staging");
    expect(env.SANDBOX_MODE).toBe(true);
  });

  it("allows production startup when all secrets are secure and demo providers are false", () => {
    const env = parseEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      ...validProductionSecrets,
      DEMO_PAYMENT_PROVIDER: "false",
      DEMO_KYC_PROVIDER: "false",
      DEMO_WITHDRAWAL_PROVIDER: "false",
    });

    expect(env.APP_ENV).toBe("production");
    expect(env.DEMO_PAYMENT_PROVIDER).toBe(false);
  });

  it("strictly fails production startup if demo payment provider is true", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        APP_ENV: "production",
        ...validProductionSecrets,
        DEMO_PAYMENT_PROVIDER: "true",
        DEMO_KYC_PROVIDER: "false",
        DEMO_WITHDRAWAL_PROVIDER: "false",
      })
    ).toThrow(/Demo simulation providers are strictly prohibited in production/);
  });

  it("strictly fails production startup even if ALLOW_DEMO_IN_PRODUCTION=true is passed", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        APP_ENV: "production",
        ...validProductionSecrets,
        DEMO_PAYMENT_PROVIDER: "false",
        DEMO_KYC_PROVIDER: "false",
        DEMO_WITHDRAWAL_PROVIDER: "false",
        ALLOW_DEMO_IN_PRODUCTION: "true",
      })
    ).toThrow(/ALLOW_DEMO_IN_PRODUCTION cannot override production safety in APP_ENV=production/);
  });

  it("fails production startup if any secret uses dev fallback", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        APP_ENV: "production",
        ...validProductionSecrets,
        AUTH_SECRET: DEV_AUTH_FALLBACK,
        DEMO_PAYMENT_PROVIDER: "false",
        DEMO_KYC_PROVIDER: "false",
        DEMO_WITHDRAWAL_PROVIDER: "false",
      })
    ).toThrow(/AUTH_SECRET in production cannot use the development fallback/);

    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        APP_ENV: "production",
        ...validProductionSecrets,
        ADMIN_STEP_UP_SECRET: DEV_ADMIN_STEP_UP_FALLBACK,
        DEMO_PAYMENT_PROVIDER: "false",
        DEMO_KYC_PROVIDER: "false",
        DEMO_WITHDRAWAL_PROVIDER: "false",
      })
    ).toThrow(/ADMIN_STEP_UP_SECRET in production cannot use the development fallback/);

    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        APP_ENV: "production",
        ...validProductionSecrets,
        TOTP_ENCRYPTION_KEY: DEV_TOTP_ENCRYPTION_KEY_FALLBACK,
        DEMO_PAYMENT_PROVIDER: "false",
        DEMO_KYC_PROVIDER: "false",
        DEMO_WITHDRAWAL_PROVIDER: "false",
      })
    ).toThrow(/TOTP_ENCRYPTION_KEY in production cannot use the development fallback/);
  });
});
