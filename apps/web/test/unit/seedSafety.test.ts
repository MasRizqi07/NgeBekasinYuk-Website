import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { assertSeedEnvironmentIsSafe } from "../../prisma/seedSafety";

const execAsync = promisify(exec);

describe("Database Seed Production Refusal Safety Test (Task 4.7)", () => {
  const seedScriptPath = path.resolve(__dirname, "../../prisma/seed.ts");

  describe("Subprocess execution guard", () => {
    it("hard refuses to execute seed when APP_ENV=production", async () => {
      let errorCaught = false;
      let output = "";

      try {
        await execAsync(`npx tsx "${seedScriptPath}"`, {
          env: {
            ...process.env,
            APP_ENV: "production",
            NODE_ENV: "test",
            ALLOW_DEMO_IN_PRODUCTION: "false",
            DEMO_PAYMENT_PROVIDER: "false",
            DEMO_KYC_PROVIDER: "false",
            DEMO_WITHDRAWAL_PROVIDER: "false",
          },
        });
      } catch (err: unknown) {
        errorCaught = true;
        const error = err as { stdout?: string; stderr?: string; message?: string };
        output = (error.stdout || "") + (error.stderr || "") + (error.message || "");
      }

      expect(errorCaught).toBe(true);
      expect(output).toContain("Cannot run deterministic seed in production environment");
    }, 15000);

    it("hard refuses to execute seed when NODE_ENV=production", async () => {
      let errorCaught = false;
      let output = "";

      try {
        await execAsync(`npx tsx "${seedScriptPath}"`, {
          env: {
            ...process.env,
            NODE_ENV: "production",
            APP_ENV: "test",
            ALLOW_DEMO_IN_PRODUCTION: "false",
            DEMO_PAYMENT_PROVIDER: "false",
            DEMO_KYC_PROVIDER: "false",
            DEMO_WITHDRAWAL_PROVIDER: "false",
          },
        });
      } catch (err: unknown) {
        errorCaught = true;
        const error = err as { stdout?: string; stderr?: string; message?: string };
        output = (error.stdout || "") + (error.stderr || "") + (error.message || "");
      }

      expect(errorCaught).toBe(true);
      expect(output).toContain("Cannot run deterministic seed in production environment");
    }, 15000);

    it("refuses execution even with CI parent environment pollution (ALLOW_DEMO_IN_PRODUCTION=true)", async () => {
      let errorCaught = false;
      let output = "";

      try {
        await execAsync(`npx tsx "${seedScriptPath}"`, {
          env: {
            ...process.env,
            APP_ENV: "production",
            NODE_ENV: "test",
            ALLOW_DEMO_IN_PRODUCTION: "true",
            DEMO_PAYMENT_PROVIDER: "true",
            DEMO_KYC_PROVIDER: "true",
            DEMO_WITHDRAWAL_PROVIDER: "true",
          },
        });
      } catch (err: unknown) {
        errorCaught = true;
        const error = err as { stdout?: string; stderr?: string; message?: string };
        output = (error.stdout || "") + (error.stderr || "") + (error.message || "");
      }

      expect(errorCaught).toBe(true);
      expect(output).toContain("Cannot run deterministic seed in production environment");
    }, 15000);
  });

  describe("assertSeedEnvironmentIsSafe synchronous assertion", () => {
    const originalAppEnv = process.env.APP_ENV;
    const originalNodeEnv = process.env.NODE_ENV;

    const envMap = process.env as Record<string, string | undefined>;

    beforeEach(() => {
      envMap.APP_ENV = "test";
      envMap.NODE_ENV = "test";
    });

    afterEach(() => {
      envMap.APP_ENV = originalAppEnv;
      envMap.NODE_ENV = originalNodeEnv;
    });

    it("allows non-production environment without throwing", () => {
      expect(() => assertSeedEnvironmentIsSafe()).not.toThrow();
    });

    it("throws immediately if APP_ENV=production", () => {
      envMap.APP_ENV = "production";
      expect(() => assertSeedEnvironmentIsSafe()).toThrow(
        "Cannot run deterministic seed in production environment"
      );
    });

    it("throws immediately if NODE_ENV=production", () => {
      envMap.NODE_ENV = "production";
      expect(() => assertSeedEnvironmentIsSafe()).toThrow(
        "Cannot run deterministic seed in production environment"
      );
    });
  });
});

