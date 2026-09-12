import { test, expect } from "@playwright/test";
import { signSession, base64UrlEncode } from "@/lib/auth/session";

test.describe("Admin Route Access Control & Cookie Tampering Defense (HP2-P0-01, HP2-P1-02)", () => {
  test("anonymous visitor attempting /admin/dashboard is redirected to /login", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });

  test("authenticated BUYER attempting /admin/dashboard is denied and redirected to /", async ({ page, context }) => {
    const buyerToken = await signSession({
      id: "usr-buyer-e2e",
      email: "buyer@test.id",
      name: "Buyer Test",
      role: "BUYER",
      isVerified: true,
    });

    await context.addCookies([
      {
        name: "ngebekasinyuk_session",
        value: buyerToken,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/admin/dashboard");
    // Middleware redirects non-admin to "/"
    await page.waitForURL("http://localhost:3000/", { timeout: 10_000 });
  });

  test("ATTACK: forged unsigned ADMIN cookie is strictly denied and redirected to /login", async ({ page, context }) => {
    // Attacker crafts payload claiming role: ADMIN with a dummy/fake signature
    const forgedPayload = {
      id: "attacker-id",
      email: "hacker@evil.com",
      name: "Attacker",
      role: "ADMIN",
      isVerified: true,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    const forgedBase64 = base64UrlEncode(JSON.stringify(forgedPayload));
    const forgedToken = `${forgedBase64}.0000000000000000000000000000000000000000000000000000000000000000`;

    await context.addCookies([
      {
        name: "ngebekasinyuk_session",
        value: forgedToken,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/admin/dashboard");
    // Cryptographic middleware must detect forged signature and redirect to /login
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });

  test("ATTACK: tampered signed cookie (buyer signature with admin payload) is rejected", async ({ page, context }) => {
    const validBuyerToken = await signSession({
      id: "usr-buyer-e2e",
      email: "buyer@test.id",
      name: "Buyer Test",
      role: "BUYER",
      isVerified: true,
    });

    const [buyerBase64, buyerSig] = validBuyerToken.split(".");
    const decoded = JSON.parse(Buffer.from(buyerBase64, "base64url").toString());
    decoded.role = "ADMIN"; // Tampered
    const tamperedBase64 = base64UrlEncode(JSON.stringify(decoded));
    const tamperedToken = `${tamperedBase64}.${buyerSig}`;

    await context.addCookies([
      {
        name: "ngebekasinyuk_session",
        value: tamperedToken,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/admin/dashboard");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });

  test("legitimate ADMIN with authentic cryptographically signed session is granted access", async ({ page, context }) => {
    const adminToken = await signSession({
      id: "usr-admin-ngebekasin",
      email: "admin@ngebekasinyuk.id",
      name: "Admin NgeBekasinYuk",
      role: "ADMIN",
      isVerified: true,
    });

    await context.addCookies([
      {
        name: "ngebekasinyuk_session",
        value: adminToken,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByText(/Platform Operations Overview/i)).toBeVisible({ timeout: 10_000 });
  });
});
