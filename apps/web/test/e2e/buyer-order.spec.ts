import { test, expect } from "@playwright/test";
import { signSession } from "@/lib/auth/session";

test.describe("Buyer Happy Path E2E Journey", () => {
  test("buyer can browse product, checkout, pay escrow, inspect, and complete order", async ({ page, context }) => {
    const buyerToken = await signSession({
      id: "usr-buyer-budi",
      email: "buyer@ngebekasinyuk.id",
      name: "Budi Pratama",
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

    // 1. Visit product page
    await page.goto("/product/ipad-air-5-64gb-wifi-starlight");
    await expect(page.getByText(/iPad Air 5/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/100% Proteksi Rekber Escrow/i).first()).toBeVisible();

    // 2. Open Checkout
    await page.goto("/checkout");
    await expect(page.getByText(/Dana Aman Ditahan Rekber/i).first()).toBeVisible({ timeout: 10_000 });

    // 3. Initiate payment
    await page.click('button:has-text("Bayar dengan Escrow")');
    await page.waitForURL(/\/payment\/.*\/pending/, { timeout: 15_000 });
    await expect(page.getByText(/Menunggu Pembayaran/i).first()).toBeVisible();

    // 4. Simulate payment callback
    await page.click('button:has-text("⚡ Simulasi Bayar Sekarang")');
    await page.waitForURL(/\/orders\/.*/, { timeout: 15_000 });
    await expect(page.getByText(/Rincian Pengiriman & Rekber/i).first()).toBeVisible();

    // 5. Simulate shipping and delivery to enter inspection
    await page.click('button:has-text("1. Simulasi Kirim Resi")');
    await page.click('button:has-text("2. Simulasi Paket Tiba")');

    // 6. Enter inspection state and release funds
    page.on("dialog", (dialog) => dialog.accept());
    await expect(page.getByText(/Lepas Dana/i).first()).toBeVisible({ timeout: 10_000 });
    await page.click('button:has-text("Lepas Dana")');

    // 7. Verify order completed and review prompt appears
    await expect(page.getByText(/Beri Ulasan Gadget/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
