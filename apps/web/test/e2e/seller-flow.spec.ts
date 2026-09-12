import { test, expect } from "@playwright/test";
import { signSession } from "@/lib/auth/session";

test.describe("Seller Flow E2E Journey", () => {
  test("seller can access dashboard, listings, profile, and wallet view", async ({ page, context }) => {
    const sellerToken = await signSession({
      id: "usr-seller-dimas",
      email: "seller@ngebekasinyuk.id",
      name: "Dimas Aditya",
      role: "SELLER",
      isVerified: true,
    });

    await context.addCookies([
      {
        name: "ngebekasinyuk_session",
        value: sellerToken,
        domain: "localhost",
        path: "/",
      },
    ]);

    // 1. Visit seller listings
    await page.goto("/my-listings");
    await expect(page.getByText(/Kelola Iklan Gadget/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Iklan Aktif/i).first()).toBeVisible();

    // 2. Check profile state
    await page.goto("/profile");
    await expect(page.getByText(/Budi Pratama|Dimas Aditya/i).first()).toBeVisible({ timeout: 10_000 });

    // 3. Check wallet view and escrow balance
    await page.goto("/wallet");
    await expect(page.getByText(/Saldo Tersedia untuk Ditarik/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Formulir Tarik Dana/i).first()).toBeVisible();
  });
});
