// NgeBekasinYuk Centralized Environment Validation
// Enforces fail-closed security for production configurations (HP2-P0-02).

import { z } from "zod";

const DEV_AUTH_FALLBACK = "dev-secret-change-in-production-min-32-chars-key";
const DEV_ADMIN_STEP_UP_FALLBACK = "dev-admin-step-up-secret-key-32-chars";

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
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    SESSION_COOKIE_NAME: z.string().default("ngebekasinyuk_session"),
    ADMIN_STEP_UP_SECRET: z.string().min(32, "ADMIN_STEP_UP_SECRET must be at least 32 characters"),
    ADMIN_STEP_UP_TTL_SECONDS: z.coerce.number().default(300),
    DEMO_PAYMENT_PROVIDER: booleanSchema(true),
    DEMO_KYC_PROVIDER: booleanSchema(true),
    DEMO_WITHDRAWAL_PROVIDER: booleanSchema(true),
    ALLOW_DEMO_IN_PRODUCTION: booleanSchema(false),
    NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
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

      // 2. Enforce PostgreSQL for production target
      if (!data.DATABASE_URL.startsWith("postgresql://") && !data.DATABASE_URL.startsWith("postgres://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DATABASE_URL"],
          message: "Production DATABASE_URL must be a PostgreSQL connection string (postgresql://...).",
        });
      }

      // 3. Prohibit unapproved demo providers in production
      if (
        (data.DEMO_PAYMENT_PROVIDER || data.DEMO_KYC_PROVIDER || data.DEMO_WITHDRAWAL_PROVIDER) &&
        !data.ALLOW_DEMO_IN_PRODUCTION
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DEMO_PAYMENT_PROVIDER"],
          message:
            "Demo simulation providers are prohibited in production unless ALLOW_DEMO_IN_PRODUCTION is explicitly set to true.",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(customEnv?: Record<string, string | undefined>): Env {
  const source = customEnv ?? process.env;
  const targetNodeEnv = (source.NODE_ENV || "development") as "development" | "test" | "production";
  const isProd = targetNodeEnv === "production";

  const rawValues = {
    NODE_ENV: targetNodeEnv,
    DATABASE_URL: source.DATABASE_URL || (isProd ? "" : "file:./dev.db"),
    AUTH_SECRET: source.AUTH_SECRET || (isProd ? "" : DEV_AUTH_FALLBACK),
    SESSION_COOKIE_NAME: source.SESSION_COOKIE_NAME || "ngebekasinyuk_session",
    ADMIN_STEP_UP_SECRET: source.ADMIN_STEP_UP_SECRET || (isProd ? "" : DEV_ADMIN_STEP_UP_FALLBACK),
    ADMIN_STEP_UP_TTL_SECONDS: source.ADMIN_STEP_UP_TTL_SECONDS || 300,
    DEMO_PAYMENT_PROVIDER: source.DEMO_PAYMENT_PROVIDER ?? (isProd ? "false" : "true"),
    DEMO_KYC_PROVIDER: source.DEMO_KYC_PROVIDER ?? (isProd ? "false" : "true"),
    DEMO_WITHDRAWAL_PROVIDER: source.DEMO_WITHDRAWAL_PROVIDER ?? (isProd ? "false" : "true"),
    ALLOW_DEMO_IN_PRODUCTION: source.ALLOW_DEMO_IN_PRODUCTION ?? "false",
    NEXT_PUBLIC_APP_URL: source.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  };

  const result = envSchema.safeParse(rawValues);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => ` - [${issue.path.join(".")}]: ${issue.message}`)
      .join("\n");
    throw new Error(`[FATAL] Invalid environment configuration:\n${formatted}`);
  }

  return result.data;
}

export const env: Env = parseEnv();
