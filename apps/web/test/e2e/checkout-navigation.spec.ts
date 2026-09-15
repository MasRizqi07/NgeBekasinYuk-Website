import { test, expect } from "@playwright/test";
import { signSession } from "@/lib/auth/session";

test.describe("Checkout Navigation State Persistence", () => {
  test("payment method is preserved after navigating away and back", async ({ page, context }) => {
    // 1. Authenticate as a buyer
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

    // 2. Open Checkout directly (which loads dummy cart state if empty)
    await page.goto("/checkout");
    await expect(page.getByText(/Dana Aman Ditahan Rekber/i).first()).toBeVisible({ timeout: 10_000 });
    
    // 3. Select a specific payment method (QRIS Instan)
    const qrisButton = page.locator('button:has-text("QRIS Instan")');
    await qrisButton.click();
    
    // Assert it is selected visually (it adds border-brand-primary class)
    await expect(qrisButton).toHaveClass(/border-brand-primary/);
    
    // 4. Navigate away (e.g. click "Bantuan Escrow" link or logo)
    await page.goto("/help/escrow");
    
    // 5. Navigate back using browser history
    await page.goBack();
    
    // 6. Ensure we are back on checkout
    await expect(page).toHaveURL(/.*\/checkout/);
    
    // 7. Verify the selected payment method is still QRIS Instan
    const qrisButtonAfter = page.locator('button:has-text("QRIS Instan")');
    await expect(qrisButtonAfter).toHaveClass(/border-brand-primary/);
  });
});
