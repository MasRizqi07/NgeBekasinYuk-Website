import { test, expect } from "@playwright/test";

test.describe("Authentication Journey E2E (HP2-P1-02)", () => {
  const testEmail = `e2e-user-${Date.now()}@ngebekasinyuk.id`;
  const testPassword = "Password123!";
  const testName = "E2E User Budi";

  test("user registration, login, session persistence, and logout flow", async ({ page, context }) => {
    // 1. Visit register page
    await page.goto("/register");
    await expect(page).toHaveTitle(/NgeBekasinYuk/i);

    // 2. Fill registration form
    await page.fill('input[type="text"]', testName);
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    // 3. Successfully registered and redirected to verification or homepage
    await page.waitForURL((url) => url.pathname.includes("/profile/verification") || url.pathname === "/", {
      timeout: 15_000,
    });
    await expect(page.locator("body")).toBeVisible();

    // 4. Verify secure signed session cookie is set
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === "ngebekasinyuk_session");
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toContain(".");

    // 5. Test invalid login attempt with incorrect password
    await context.clearCookies();
    await page.goto("/login");
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', "WrongPassword999!");
    await page.click('button[type="submit"]');

    // Error toast or message appears
    await expect(page.getByText(/Email atau kata sandi tidak cocok/i)).toBeVisible({ timeout: 10_000 });

    // 6. Valid login attempt with correct password
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL("/", { timeout: 15_000 });

    // 7. Verify session is restored and persisted
    const newCookies = await context.cookies();
    const restoredCookie = newCookies.find((c) => c.name === "ngebekasinyuk_session");
    expect(restoredCookie).toBeDefined();
    expect(restoredCookie?.value).toContain(".");

    // 8. Test logout via API or session clearing
    await page.request.post("/api/auth/logout");
    await page.goto("/login");
    await expect(page.getByText(/Masuk ke Akun/i).first()).toBeVisible();
  });
});
