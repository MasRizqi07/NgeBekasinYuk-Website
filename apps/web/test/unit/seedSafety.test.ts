import { describe, it, expect } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

describe("Database Seed Production Refusal Safety Test (Task 4.7)", () => {
  const seedScriptPath = path.resolve(__dirname, "../../prisma/seed.ts");

  it("hard refuses to execute seed when APP_ENV=production", async () => {
    let errorCaught = false;
    let output = "";

    try {
      await execAsync(`npx tsx "${seedScriptPath}"`, {
        env: {
          ...process.env,
          APP_ENV: "production",
          DEMO_PAYMENT_PROVIDER: "false",
          DEMO_KYC_PROVIDER: "false",
          DEMO_WITHDRAWAL_PROVIDER: "false",
        },
      });
    } catch (err: any) {
      errorCaught = true;
      output = (err.stdout || "") + (err.stderr || "") + (err.message || "");
    }

    expect(errorCaught).toBe(true);
    expect(output).toContain("Cannot run deterministic seed in production environment");
  });

  it("hard refuses to execute seed when NODE_ENV=production", async () => {
    let errorCaught = false;
    let output = "";

    try {
      await execAsync(`npx tsx "${seedScriptPath}"`, {
        env: {
          ...process.env,
          NODE_ENV: "production",
        },
      });
    } catch (err: any) {
      errorCaught = true;
      output = (err.stdout || "") + (err.stderr || "") + (err.message || "");
    }

    expect(errorCaught).toBe(true);
    expect(output).toContain("Cannot run deterministic seed in production environment");
  });
});
