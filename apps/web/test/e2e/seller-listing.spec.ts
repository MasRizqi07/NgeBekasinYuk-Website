import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { signSession } from "@/lib/auth/session";
import { prisma } from "@/server/db/prisma";

// Minimal valid 1x1 PNG file for upload tests
const ONE_PX_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

test.describe("Seller Listing Creation, Search Visibility & Cart Integrity", () => {
  test("seller publishes listing with image via /sell, buyer opens via /search, and stale archived cart item is dropped", async ({
    browser,
  }) => {
    const suffix = crypto.randomBytes(3).toString("hex");
    const uniqueTitle = `E2E Keychron Q1 Pro ${suffix}`;

    const sellerContext = await browser.newContext();
    const sellerToken = await signSession({
      id: "usr-seller-dimas",
      email: "seller@ngebekasinyuk.id",
      name: "Dimas Aditya",
      role: "SELLER",
      isVerified: true,
    });
    await sellerContext.addCookies([
      {
        name: "ngebekasinyuk_session",
        value: sellerToken,
        domain: "localhost",
        path: "/",
      },
    ]);

    const sellerPage = await sellerContext.newPage();
    await sellerPage.goto("/sell");
    await expect(sellerPage.getByText("Pasang Iklan Gadget Bekas")).toBeVisible();

    // Step 1: upload valid PNG image
    await sellerPage.locator('input[type="file"]').setInputFiles({
      name: "gadget-photo.png",
      mimeType: "image/png",
      buffer: ONE_PX_PNG,
    });
    await sellerPage.getByRole("button", { name: /Lanjut ke Spesifikasi/i }).click();

    // Step 2: specs
    await sellerPage.locator("#sell-title").fill(uniqueTitle);
    await sellerPage.locator("#sell-brand").fill("Keychron");
    await sellerPage.locator("#sell-model").fill("Q1 Pro");
    await sellerPage.getByRole("button", { name: /Lanjut ke Harga/i }).click();

    // Step 3: price & description
    await sellerPage.locator("#sell-price").fill("2750000");
    await sellerPage
      .locator("#sell-description")
      .fill("Keyboard mechanical wireless kondisi prima lengkap box.");
    await sellerPage.getByRole("button", { name: /Review Iklan/i }).click();

    // Step 4: publish
    await sellerPage
      .getByRole("button", { name: /Tayangkan Iklan Sekarang/i })
      .click();

    await sellerPage.waitForURL(/\/product\/e2e-keychron-q1-pro/, {
      timeout: 15_000,
    });
    await expect(sellerPage.getByRole("heading", { name: uniqueTitle })).toBeVisible();

    // Buyer searches in fresh browser context and opens listing detail
    const buyerContext = await browser.newContext();
    const buyerToken = await signSession({
      id: "usr-buyer-budi",
      email: "buyer@ngebekasinyuk.id",
      name: "Budi Pratama",
      role: "BUYER",
      isVerified: true,
    });
    await buyerContext.addCookies([
      {
        name: "ngebekasinyuk_session",
        value: buyerToken,
        domain: "localhost",
        path: "/",
      },
    ]);

    const buyerPage = await buyerContext.newPage();
    await buyerPage.goto(`/search?q=${encodeURIComponent(suffix)}`);
    await expect(buyerPage.getByText(uniqueTitle)).toBeVisible({
      timeout: 15_000,
    });

    await buyerPage.getByRole("link", { name: uniqueTitle }).first().click();
    await buyerPage.waitForURL(/\/product\/e2e-keychron-q1-pro/);

    // Verify image rendered from local storage route
    const imgUrl = await buyerPage
      .locator('img[alt="' + uniqueTitle + '"]')
      .first()
      .getAttribute("src");
    expect(imgUrl).toContain("/api/listings/images/");

    // Put listing in cart via "Beli Sekarang"
    await buyerPage.getByRole("button", { name: /Beli Sekarang/i }).click();
    await buyerPage.waitForURL(/\/checkout/);
    await expect(buyerPage.getByText(uniqueTitle)).toBeVisible({
      timeout: 10_000,
    });

    // A1 check: cart localStorage persists IDs only (zero prices or listing objects)
    const rawCartStorage = await buyerPage.evaluate(() =>
      window.localStorage.getItem("ngebekasinyuk-cart-storage")
    );
    expect(rawCartStorage).toBeTruthy();
    const parsedCart = JSON.parse(rawCartStorage!);
    expect(parsedCart.state.items).toHaveLength(1);
    expect(Object.keys(parsedCart.state.items[0])).toEqual(["listingId"]);
    expect(rawCartStorage).not.toContain("2750000");
    expect(rawCartStorage).not.toContain(uniqueTitle);

    // Archive listing via /my-listings -> seller archives while buyer holds ID in cart
    await sellerPage.goto("/my-listings");
    await expect(sellerPage.getByText(uniqueTitle)).toBeVisible({
      timeout: 10_000,
    });

    const createdListing = await prisma.productListing.findFirst({
      where: { title: uniqueTitle },
      select: { id: true },
    });
    expect(createdListing).not.toBeNull();

    const archiveRes = await sellerPage.request.post(
      `/api/listings/${createdListing!.id}/archive`
    );
    expect(archiveRes.status()).toBe(200);

    // AC10.10: buyer reloads /cart & /checkout -> item dropped automatically with clear notice
    await buyerPage.goto("/cart");
    await expect(buyerPage.getByRole("alert")).toBeVisible({ timeout: 10_000 });
    await expect(buyerPage.getByText(/tidak lagi tersedia/i)).toBeVisible();

    await buyerPage.goto("/checkout");
    // Stale archived item cannot be purchased; cart was cleaned up
    await expect(buyerPage.getByText(uniqueTitle)).not.toBeVisible();

    // Relist restores item cleanly in /my-listings
    const relistRes = await sellerPage.request.post(
      `/api/listings/${createdListing!.id}/relist`
    );
    expect(relistRes.status()).toBe(200);

    // Cleanup E2E created listing
    await prisma.listingImage.deleteMany({
      where: { listingId: createdListing!.id },
    });
    await prisma.productListing.delete({
      where: { id: createdListing!.id },
    });

    await buyerContext.close();
    await sellerContext.close();
  });
});
