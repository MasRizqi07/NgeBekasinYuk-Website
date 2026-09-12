// NgeBekasinYuk Centralized Environment Validation
// Enforces fail-closed security for production & staging configurations (HP2-P0-02, HP3-P1-03).

import { z } from "zod";

export const DEV_AUTH_FALLBACK = "dev-secret-change-in-production-min-32-chars-key";
export const DEV_ADMIN_STEP_UP_FALLBACK = "dev-admin-step-up-secret-key-32-chars";
export const DEV_TOTP_ENCRYPTION_KEY_FALLBACK = "dev-totp-encryption-key-32-chars-test";

const booleanSchema = (defaultValue: boolean) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return defaultValue;
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
      const lower = val.trim().toLowerCase();
      if (lower === "true" || lower === "1" || lower === "yes") return true;
      if (lower === "false" || lower === "0" || lower === "no") return false;
    }
    return Boolean(val);
  }, z.boolean());

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    SESSION_COOKIE_NAME: z.string().default("ngebekasinyuk_session"),
    ADMIN_STEP_UP_SECRET: z.string().min(32, "ADMIN_STEP_UP_SECRET must be at least 32 characters"),
    ADMIN_STEP_UP_TTL_SECONDS: z.coerce.number().default(300),
    TOTP_ENCRYPTION_KEY: z.string().min(32, "TOTP_ENCRYPTION_KEY must be at least 32 characters"),
    DEMO_PAYMENT_PROVIDER: booleanSchema(true),
    DEMO_KYC_PROVIDER: booleanSchema(true),
    DEMO_WITHDRAWAL_PROVIDER: booleanSchema(true),
    SANDBOX_MODE: booleanSchema(false),
    ALLOW_DEMO_IN_PRODUCTION: booleanSchema(false),
    NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  })
  .superRefine((data, ctx) => {
    const isProductionApp = data.APP_ENV === "production";
    const isStagingApp = data.APP_ENV === "staging";

    if (isProductionApp) {
      // 1. Prohibit predictable development fallback secrets in production
      if (data.AUTH_SECRET === DEV_AUTH_FALLBACK) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_SECRET"],
          message: "AUTH_SECRET in production cannot use the development fallback secret.",
        });
      }

      if (data.ADMIN_STEP_UP_SECRET === DEV_ADMIN_STEP_UP_FALLBACK) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ADMIN_STEP_UP_SECRET"],
          message: "ADMIN_STEP_UP_SECRET in production cannot use the development fallback secret.",
        });
      }

      if (data.TOTP_ENCRYPTION_KEY === DEV_TOTP_ENCRYPTION_KEY_FALLBACK) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["TOTP_ENCRYPTION_KEY"],
          message: "TOTP_ENCRYPTION_KEY in production cannot use the development fallback secret.",
        });
      }

      // 2. Enforce PostgreSQL for production target
      if (!data.DATABASE_URL.startsWith("postgresql://") && !data.DATABASE_URL.startsWith("postgres://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DATABASE_URL"],
          message: "Production DATABASE_URL must be a PostgreSQL connection string (postgresql://...).",
        });
      }

      // 3. Absolute prohibition of demo providers in production (HP3-P1-03)
      if (data.DEMO_PAYMENT_PROVIDER || data.DEMO_KYC_PROVIDER || data.DEMO_WITHDRAWAL_PROVIDER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DEMO_PAYMENT_PROVIDER"],
          message: "Demo simulation providers are strictly prohibited in production.",
        });
      }

      if (data.ALLOW_DEMO_IN_PRODUCTION) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ALLOW_DEMO_IN_PRODUCTION"],
          message: "ALLOW_DEMO_IN_PRODUCTION cannot override production safety in APP_ENV=production.",
        });
      }
    } else if (isStagingApp) {
      // Staging allows demo simulation ONLY if SANDBOX_MODE is explicitly enabled
      if ((data.DEMO_PAYMENT_PROVIDER || data.DEMO_KYC_PROVIDER || data.DEMO_WITHDRAWAL_PROVIDER) && !data.SANDBOX_MODE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SANDBOX_MODE"],
          message: "Demo simulation providers in staging require SANDBOX_MODE=true.",
        });
      }

      if (data.NODE_ENV === "production") {
        if (data.AUTH_SECRET === DEV_AUTH_FALLBACK) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["AUTH_SECRET"],
            message: "AUTH_SECRET in staging build cannot use the development fallback secret.",
          });
        }
        if (data.ADMIN_STEP_UP_SECRET === DEV_ADMIN_STEP_UP_FALLBACK) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ADMIN_STEP_UP_SECRET"],
            message: "ADMIN_STEP_UP_SECRET in staging build cannot use the development fallback secret.",
          });
        }
        if (data.TOTP_ENCRYPTION_KEY === DEV_TOTP_ENCRYPTION_KEY_FALLBACK) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["TOTP_ENCRYPTION_KEY"],
            message: "TOTP_ENCRYPTION_KEY in staging build cannot use the development fallback secret.",
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(customEnv?: Record<string, string | undefined>): Env {
  const source = customEnv ?? process.env;
  const targetNodeEnv = (source.NODE_ENV || "development") as "development" | "test" | "production";
  const targetAppEnv = (source.APP_ENV || (targetNodeEnv === "production" ? "production" : "development")) as
    | "development"
    | "test"
    | "staging"
    | "production";

  const isProd = targetAppEnv === "production";

  const rawValues = {
    NODE_ENV: targetNodeEnv,
    APP_ENV: targetAppEnv,
    DATABASE_URL: source.DATABASE_URL || (isProd ? "" : "postgresql://postgres:postgres@localhost:5433/ngebekasinyuk_db?schema=public"),
    AUTH_SECRET: source.AUTH_SECRET || (isProd ? "" : DEV_AUTH_FALLBACK),
    SESSION_COOKIE_NAME: source.SESSION_COOKIE_NAME || "ngebekasinyuk_session",
    ADMIN_STEP_UP_SECRET: source.ADMIN_STEP_UP_SECRET || (isProd ? "" : DEV_ADMIN_STEP_UP_FALLBACK),
    ADMIN_STEP_UP_TTL_SECONDS: source.ADMIN_STEP_UP_TTL_SECONDS || 300,
    TOTP_ENCRYPTION_KEY: source.TOTP_ENCRYPTION_KEY || (isProd ? "" : DEV_TOTP_ENCRYPTION_KEY_FALLBACK),
    DEMO_PAYMENT_PROVIDER: source.DEMO_PAYMENT_PROVIDER ?? (isProd ? "false" : "true"),
    DEMO_KYC_PROVIDER: source.DEMO_KYC_PROVIDER ?? (isProd ? "false" : "true"),
    DEMO_WITHDRAWAL_PROVIDER: source.DEMO_WITHDRAWAL_PROVIDER ?? (isProd ? "false" : "true"),
    SANDBOX_MODE: source.SANDBOX_MODE ?? "false",
    ALLOW_DEMO_IN_PRODUCTION: source.ALLOW_DEMO_IN_PRODUCTION ?? "false",
    NEXT_PUBLIC_APP_URL: source.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  };

  const result = envSchema.safeParse(rawValues);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((err) => ` - [${err.path.join(".")}]: ${err.message}`)
      .join("\n");
    throw new Error(
      `[NgeBekasinYuk] Environment Configuration Validation Failed (Fail-Closed):\n${errorDetails}`
    );
  }

  return result.data;
}

export const env: Env = parseEnv();
