import { test, expect } from "@playwright/test";
import { signSession } from "@/lib/auth/session";

test.describe("Buyer Happy Path E2E Journey", () => {
  test("buyer can browse product, checkout, pay escrow, inspect, and complete order", async ({ page, context }) => {
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
    });
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

    // MOCK THE API FOR E2E TEST SINCE CHECKOUT HAS NO BACKEND
    let mockOrder: any = null;
    await context.route('**/api/orders/**', async (route) => {
      const request = route.request();
      const url = request.url();
      if (request.method() === 'GET' && !url.includes('transition')) {
        // Extract order ID: URL is /api/orders/{id}
        const parts = url.split('/');
        const ordersIdx = parts.indexOf('orders');
        const id = ordersIdx !== -1 ? parts[ordersIdx + 1] : parts.pop();
        if (!mockOrder) {
          mockOrder = {
            id,
            status: 'FUNDED',
            buyerId: 'usr-buyer-budi',
            sellerId: 'usr-seller-1',
            buyerName: 'Budi Pratama',
            buyerPhone: '081234567890',
            itemPrice: 10000000,
            shippingFee: 50000,
            escrowFee: 0,
            totalAmount: 10050000,
            paymentMethod: 'BCA_VA',
            courier: 'J&T Reguler',
            shippingAddress: 'Mock Address',
            inspectionExpiresAt: null,
            createdAt: new Date().toISOString(),
            listing: { title: 'iPad Air 5', price: 10000000, id: 'list-1', images: [], condition: 'Bekas - Normal', seller: { name: 'Seller', city: 'Jakarta' } },
            buyer: { id: 'usr-buyer-budi', name: 'Budi Pratama' },
            seller: { id: 'usr-seller-1', name: 'Seller' }
          };
        }
        await route.fulfill({ json: mockOrder });
      } else if (request.method() === 'POST' && url.includes('transition')) {
        const body = JSON.parse(request.postData() || '{}');
        mockOrder.status = body.toStatus;
        if (body.toStatus === 'INSPECTING') {
          mockOrder.inspectionExpiresAt = new Date(Date.now() + 172800000).toISOString();
        }
        await route.fulfill({ json: { success: true, order: mockOrder } });
      } else {
        await route.continue();
      }
    });

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
    try {
      await expect(page.getByText(/Rincian Pengiriman & Rekber/i).first()).toBeVisible({ timeout: 5000 });
    } catch (e) {
      await page.screenshot({ path: 'test-failure-screenshot.png', fullPage: true });
      console.log("PAGE CONTENT ON FAILURE:", await page.content());
      throw e;
    }

    // 5. Simulate shipping and delivery to enter inspection
    // Click "Simulasi Kirim Resi" — this triggers a POST to /transition then window.location.reload()
    await page.click('button:has-text("1. Simulasi Kirim Resi")');
    await page.waitForLoadState('networkidle');
    // After reload, the mock returns order with status=SHIPPED
    await page.waitForTimeout(1000);

    // Click "Simulasi Paket Tiba" — transitions to INSPECTING then reloads
    await page.click('button:has-text("2. Simulasi Paket Tiba")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 6. Enter inspection state and release funds
    page.on("dialog", (dialog) => dialog.accept());
    try {
      await expect(page.getByText(/Lepas Dana/i).first()).toBeVisible({ timeout: 10_000 });
    } catch (e) {
      await page.screenshot({ path: 'test-failure-screenshot-2.png', fullPage: true });
      console.log("PAGE CONTENT ON FAILURE 2:", await page.content());
      throw e;
    }
    await page.click('button:has-text("Lepas Dana")');

    // 7. Verify order completed and review prompt appears
    await expect(page.getByText(/Beri Ulasan Gadget/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
