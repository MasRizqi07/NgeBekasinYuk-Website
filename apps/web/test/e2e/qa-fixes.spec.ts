import { test, expect } from "@playwright/test";
import { prisma } from "@/server/db/prisma";

test.describe("QA Fixes E2E: Mobile Overflow, Auth Identity, Next Redirect, GoSend & OrderTimeline", () => {
  test("mobile 390x844 has zero horizontal overflow, no hydration error, and guest sees Masuk (no Budi spoofing)", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of ["/", "/search", "/orders", "/profile", "/profile/verification"]) {
      await page.goto(route, { waitUntil: "networkidle" });
      const dims = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(dims.scrollWidth, `overflow on ${route}`).toBeLessThanOrEqual(
        dims.innerWidth
      );
    }

    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /^Masuk$/i }).first()).toBeVisible();
    const headerText = await page.locator("header").innerText();
    expect(headerText).not.toContain("Budi Pratama");
    expect(pageErrors).toEqual([]);
  });

  test("login ?next=/orders redirects accurately, fake Google button never authenticates, seller sees Dimas Aditya and can logout", async ({
    page,
  }) => {
    await page.goto("/login?next=%2Forders", { waitUntil: "networkidle" });

    // Demo Google button shows info notice without creating any server session
    await page.getByRole("button", { name: /Google/i }).click();
    await expect(page).toHaveURL(/\/login/);
    const guestSess = await page.evaluate(async () => {
      const r = await fetch("/api/auth/session", { cache: "no-store" });
      return r.json();
    });
    expect(guestSess.authenticated).toBe(false);

    // Login as seeded Seller -> redirects to /orders via ?next=/orders
    await page.fill('input[type="email"]', "seller@ngebekasinyuk.id");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/orders$/, { timeout: 15_000 });

    // Navbar & /profile display Dimas Aditya (never Budi Pratama)
    await page.goto("/profile", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText("Dimas Aditya");
    expect(await page.locator("main").innerText()).not.toContain("Budi Pratama");

    await page.getByRole("button", { name: "Menu Akun" }).click();
    await expect(page.locator("header")).toContainText("Dimas Aditya");
    await expect(page.locator("header")).toContainText("seller@ngebekasinyuk.id");

    // Click Keluar (Logout) from Navbar dropdown -> returns to /login and session cleared
    await page.locator("header").getByRole("button", { name: /Keluar/i }).click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    const afterLogout = await page.evaluate(async () => {
      const r = await fetch("/api/auth/session", { cache: "no-store" });
      return r.json();
    });
    expect(afterLogout.authenticated).toBe(false);
  });

  test("GoSend checkout matches server Rp 45.000, order Chat button opens real thread, and OrderTimeline simulates delivery cleanly", async ({
    page,
  }) => {
    const slug = "asus-tuf-gaming-geforce-rtx-3070-ti-8gb";
    const listing = await prisma.productListing.findUniqueOrThrow({
      where: { slug },
    });

    // Ensure clean ACTIVE fixture for hermetic execution
    await prisma.order.updateMany({
      where: {
        listingId: listing.id,
        status: { notIn: ["CANCELLED", "REFUNDED", "COMPLETED"] },
      },
      data: { status: "CANCELLED" },
    });
    await prisma.productListing.update({
      where: { id: listing.id },
      data: { status: "ACTIVE" },
    });

    // Login as buyer via UI
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', "buyer@ngebekasinyuk.id");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("/", { timeout: 15_000 });

    // Checkout using GoSend -> quoted Rp 45.000 matches server shippingFee
    await page.goto(`/checkout?listingId=${encodeURIComponent(listing.id)}`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: /GoSend/i }).first().click();
    await expect(page.locator("main")).toContainText(/Rp\s*45\.000/);

    await page.getByRole("button", { name: /Bayar dengan Escrow/i }).click();
    await page.waitForURL(/\/payment\/([^/]+)\/pending/, { timeout: 15_000 });
    const orderId = page.url().match(/\/payment\/([^/]+)\/pending/)![1];

    const createdOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(createdOrder.shippingFee).toBe(45000);

    // Simulate payment -> FUNDED -> Simulasi Kirim Resi -> SHIPPED
    await page.click('button:has-text("⚡ Simulasi Bayar Sekarang")');
    await page.waitForURL(new RegExp(`/orders/${orderId}`), { timeout: 15_000 });

    await page.getByRole("button", { name: /1\. Simulasi Kirim Resi/i }).click();
    await expect
      .poll(
        async () =>
          (await prisma.order.findUnique({ where: { id: orderId } }))?.status,
        { timeout: 10_000 }
      )
      .toBe("SHIPPED");

    // Verify OrderTimeline "Kurir: Simulasikan Paket Tiba" succeeds via /simulate -> INSPECTING
    const deliverBtn = page.getByRole("button", {
      name: /Kurir: Simulasikan Paket Tiba/i,
    });
    await expect(deliverBtn).toBeVisible({ timeout: 10_000 });
    const [simResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/simulate")),
      deliverBtn.click(),
    ]);
    expect(simResp.status()).toBe(200);
    await expect
      .poll(
        async () =>
          (await prisma.order.findUnique({ where: { id: orderId } }))?.status,
        { timeout: 10_000 }
      )
      .toBe("INSPECTING");

    // Verify Chat button on Order Detail opens real conversation (not /chat/c-dimas 404)
    await page.goto(`/orders/${orderId}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^Chat$/i }).click();
    await page.waitForURL(/\/chat\/(?!c-dimas)[a-z0-9_-]+$/i, { timeout: 10_000 });
    await expect(page.locator("body")).not.toContainText(
      "Percakapan Tidak Ditemukan"
    );

    // Restore fixture cleanly
    await prisma.order.updateMany({
      where: { listingId: listing.id, id: orderId },
      data: { status: "CANCELLED" },
    });
    await prisma.productListing.update({
      where: { id: listing.id },
      data: { status: "ACTIVE" },
    });
  });
});
