import { test, expect } from "@playwright/test";
import { signSession } from "@/lib/auth/session";
import { prisma } from "@/server/db/prisma";

// ==============================================================================
// NgeBekasinYuk Server-Authoritative Buyer Journey E2E Test Suite
//
// ZERO API MOCKS POLICY:
// All order creation, payment simulation, shipping transitions, and escrow releases
// execute against real Next.js API route handlers backed by PostgreSQL transactions.
// ==============================================================================

/**
 * Test Fixture Reset Helper for E2E Buyer Flow
 *
 * Scoped strictly to the fixture listing ('prod-ipad-air5').
 * Why this is necessary: The marketplace UI product catalog on the client side
 * relies on client-simulated catalog data (apps/web/src/lib/seedData.ts), where
 * the product detail page and checkout specifically route to 'prod-ipad-air5'.
 * To ensure hermetic end-to-end tests without test-order pollution from prior runs,
 * any dangling active orders on this seed listing are cleaned up and the listing
 * is restored to 'ACTIVE' before each test.
 */
async function resetSeedListingFixtureForE2E(listingId = "prod-ipad-air5"): Promise<void> {
  await prisma.order.updateMany({
    where: {
      listingId,
      status: { notIn: ["CANCELLED", "REFUNDED", "COMPLETED"] },
    },
    data: { status: "CANCELLED" },
  });
  await prisma.productListing.update({
    where: { id: listingId },
    data: { status: "ACTIVE" },
  });
}

test.describe("Buyer Authoritative Order Flow (Real PostgreSQL)", () => {
  test.beforeEach(async () => {
    await resetSeedListingFixtureForE2E("prod-ipad-air5");
  });

  test("buyer can browse product, checkout, pay escrow, inspect, and complete order", async ({
    page,
    context,
    request,
  }) => {
    page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text());
    });

    // 1. Authenticate as Buyer (usr-buyer-budi)
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

    // 2. Visit Product Detail Page (PDP)
    await page.goto("/product/ipad-air-5-64gb-wifi-starlight");
    await expect(page.getByText(/iPad Air 5/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/100% Proteksi Rekber Escrow/i).first()).toBeVisible();

    // 3. Navigate to Checkout via Beli Sekarang button
    await page.click('button:has-text("Beli Sekarang")');
    await page.waitForURL(/\/checkout/, { timeout: 10_000 });
    await expect(page.getByText(/Dana Aman Ditahan Rekber/i).first()).toBeVisible({ timeout: 10_000 });

    // 4. Submit Order to real server API (POST /api/orders)
    await page.click('button:has-text("Bayar dengan Escrow")');
    await page.waitForURL(/\/payment\/.*\/pending/, { timeout: 15_000 });
    await expect(page.getByText(/Menunggu Pembayaran/i).first()).toBeVisible();

    // Extract real server-generated order ID from the URL
    const paymentUrl = page.url();
    const orderIdMatch = paymentUrl.match(/\/payment\/([^/]+)\/pending/);
    expect(orderIdMatch).not.toBeNull();
    const orderId = orderIdMatch![1];
    expect(orderId).toMatch(/^ord-/);

    // Verify listing is atomically RESERVED in PostgreSQL after checkout
    const dbListingReserved = await prisma.productListing.findUniqueOrThrow({
      where: { id: "prod-ipad-air5" },
    });
    expect(dbListingReserved.status).toBe("RESERVED");

    // 5. Trigger Real Payment Webhook Simulation (POST /api/payment/simulate-webhook)
    await page.click('button:has-text("⚡ Simulasi Bayar Sekarang")');
    await page.waitForURL(new RegExp(`/orders/${orderId}`), { timeout: 15_000 });
    await expect(page.getByText(/Rincian Pengiriman & Rekber/i).first()).toBeVisible({ timeout: 10_000 });

    // Verify order funding & escrow hold in PostgreSQL
    const dbOrderFunded = await prisma.order.findUnique({
      where: { id: orderId },
      include: { escrowAccount: true },
    });
    expect(dbOrderFunded).not.toBeNull();
    expect(dbOrderFunded?.status).toBe("FUNDED");
    expect(dbOrderFunded?.escrowAccount).not.toBeNull();
    expect(dbOrderFunded?.escrowAccount?.status).toBe("HELD");

    // 6. Real Seller marks order as SHIPPED via authoritative transition endpoint
    const sellerToken = await signSession({
      id: dbOrderFunded!.sellerId,
      email: "seller@ngebekasinyuk.id",
      name: "Dimas Aditya",
      role: "SELLER",
      isVerified: true,
    });

    const shipRes = await request.post(`http://localhost:3000/api/orders/${orderId}/transition`, {
      headers: {
        Cookie: `ngebekasinyuk_session=${sellerToken}`,
        "Content-Type": "application/json",
      },
      data: {
        toStatus: "SHIPPED",
        shippingCourier: "J&T Express",
        shippingAirwayBill: "JT928174829102",
      },
    });
    expect(shipRes.ok()).toBeTruthy();
    const shipJson = await shipRes.json();
    expect(shipJson.success).toBe(true);

    // 7. Real Admin/Courier marks order as DELIVERED and initiates INSPECTING
    const adminToken = await signSession({
      id: "usr-admin-ngebekasin",
      email: "admin@ngebekasinyuk.id",
      name: "Admin NgeBekasinYuk",
      role: "ADMIN",
      isVerified: true,
    });

    const deliverRes = await request.post(`http://localhost:3000/api/orders/${orderId}/transition`, {
      headers: {
        Cookie: `ngebekasinyuk_session=${adminToken}`,
        "Content-Type": "application/json",
      },
      data: {
        toStatus: "DELIVERED",
      },
    });
    expect(deliverRes.ok()).toBeTruthy();

    const inspectRes = await request.post(`http://localhost:3000/api/orders/${orderId}/transition`, {
      headers: {
        Cookie: `ngebekasinyuk_session=${adminToken}`,
        "Content-Type": "application/json",
      },
      data: {
        toStatus: "INSPECTING",
      },
    });
    expect(inspectRes.ok()).toBeTruthy();

    // 8. Assert in PostgreSQL: status is INSPECTING and inspectionExpiresAt is non-null
    const dbOrderInspecting = await prisma.order.findUnique({
      where: { id: orderId },
    });
    expect(dbOrderInspecting?.status).toBe("INSPECTING");
    expect(dbOrderInspecting?.inspectionExpiresAt).not.toBeNull();

    // 9. Buyer reloads order page to see inspection state and release button
    await page.reload();
    await expect(page.getByText(/Paket Tiba! Masa Inspeksi Dimulai/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Lepas Dana/i).first()).toBeVisible({ timeout: 10_000 });

    // 10. Buyer clicks "Lepas Dana" to authoritatively release funds
    page.on("dialog", (dialog) => dialog.accept());
    await page.click('button:has-text("Lepas Dana")');

    // 11. Assert UI reflects COMPLETED status with review modal / prompt
    await expect(page.getByText(/Beri Ulasan Gadget/i).first()).toBeVisible({ timeout: 10_000 });

    // 12. Assert in PostgreSQL: order COMPLETED, escrow RELEASED, seller wallet credited
    const dbOrderCompleted = await prisma.order.findUnique({
      where: { id: orderId },
      include: { escrowAccount: true },
    });
    expect(dbOrderCompleted?.status).toBe("COMPLETED");
    expect(dbOrderCompleted?.escrowAccount?.status).toBe("RELEASED");

    // Verify listing is marked SOLD in PostgreSQL upon escrow completion
    const dbListingSold = await prisma.productListing.findUniqueOrThrow({
      where: { id: "prod-ipad-air5" },
    });
    expect(dbListingSold.status).toBe("SOLD");

    const sellerLedger = await prisma.walletLedgerEntry.findFirst({
      where: {
        referenceId: orderId,
        referenceType: "ORDER",
        type: "ESCROW_RELEASE",
        direction: "CREDIT",
      },
    });
    expect(sellerLedger).not.toBeNull();
    expect(sellerLedger?.amount).toBe(dbOrderCompleted?.itemPrice);
  });

  test("negative: tampered price or injected buyerId in order creation is rejected and never reaches DB", async ({
    request,
  }) => {
    const buyerToken = await signSession({
      id: "usr-buyer-budi",
      email: "buyer@ngebekasinyuk.id",
      name: "Budi Pratama",
      role: "BUYER",
      isVerified: true,
    });

    // 1. Record baseline order count in PostgreSQL
    const countBaseline = await prisma.order.count();

    // 2. Malicious request attempting to tamper with prices (itemPrice & totalAmount)
    const priceTamperRes = await request.post("http://localhost:3000/api/orders", {
      headers: {
        Cookie: `ngebekasinyuk_session=${buyerToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `tamper-attempt-${Date.now()}`,
      },
      data: {
        listingId: "prod-ipad-air5",
        shippingAddress: "Jl. Percobaan Tamper No. 999, Jakarta",
        courier: "J&T Express Regular",
        paymentMethod: "BCA_VA",
        itemPrice: 500,
        totalAmount: 500,
      },
    });

    // CreateOrderSchema has .strict(), rejecting unrecognized keys with 400 VALIDATION_ERROR
    expect(priceTamperRes.status()).toBe(400);
    const priceTamperBody = await priceTamperRes.json();
    expect(priceTamperBody.error).toBe("VALIDATION_ERROR");

    // Assert row count in PostgreSQL is strictly unchanged
    const countAfterPriceTamper = await prisma.order.count();
    expect(countAfterPriceTamper).toBe(countBaseline);

    // 3. Malicious request carrying valid fields but injecting another user's buyerId
    const buyerIdTamperRes = await request.post("http://localhost:3000/api/orders", {
      headers: {
        Cookie: `ngebekasinyuk_session=${buyerToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `spoof-buyer-${Date.now()}`,
      },
      data: {
        listingId: "prod-ipad-air5",
        shippingAddress: "Jl. Percobaan Spoof No. 123, Jakarta",
        courier: "J&T Express Regular",
        paymentMethod: "BCA_VA",
        buyerId: "usr-victim-999", // Unrecognized field: server must derive buyer only from session
      },
    });

    // Strict schema rejects injected buyerId with 400 VALIDATION_ERROR
    expect(buyerIdTamperRes.status()).toBe(400);
    const buyerIdTamperBody = await buyerIdTamperRes.json();
    expect(buyerIdTamperBody.error).toBe("VALIDATION_ERROR");

    // Assert row count in PostgreSQL remains strictly unchanged
    const countAfterBuyerIdTamper = await prisma.order.count();
    expect(countAfterBuyerIdTamper).toBe(countBaseline);

    // Verify in PostgreSQL that no order with the tampered amount exists
    const tamperedOrder = await prisma.order.findFirst({
      where: {
        buyerId: "usr-buyer-budi",
        totalAmount: 500,
      },
    });
    expect(tamperedOrder).toBeNull();
  });

  test("buyer session attempting seller/courier simulation transitions is rejected with 422", async ({
    request,
  }) => {
    const buyerToken = await signSession({
      id: "usr-buyer-budi",
      email: "buyer@ngebekasinyuk.id",
      name: "Budi Pratama",
      role: "BUYER",
      isVerified: true,
    });

    // Create a fresh test order in FUNDED status
    const fundedOrder = await prisma.order.create({
      data: {
        id: `ord-test-buyer-click-${Date.now()}`,
        orderNumber: `ORD-${Date.now()}`,
        buyerId: "usr-buyer-budi",
        sellerId: "usr-seller-dimas",
        listingId: "prod-ipad-air5",
        itemPrice: 7500000,
        shippingFee: 50000,
        escrowFee: 0,
        totalAmount: 7550000,
        status: "FUNDED",
        shippingAddress: "Jl. Test 123",
        shippingCourier: "J&T Express",
      },
    });

    const testOrder = fundedOrder;

    // 1. Buyer attempts '1. Simulasi Kirim Resi' (toStatus: SHIPPED)
    const shipRes = await request.post(`http://localhost:3000/api/orders/${testOrder!.id}/transition`, {
      headers: {
        Cookie: `ngebekasinyuk_session=${buyerToken}`,
        "Content-Type": "application/json",
      },
      data: {
        toStatus: "SHIPPED",
        shippingCourier: "JT",
        shippingAirwayBill: "JT1234567890",
      },
    });
    console.log("Buyer 'Simulasi Kirim Resi' HTTP Status:", shipRes.status());
    console.log("Buyer 'Simulasi Kirim Resi' Body:", await shipRes.text());
    expect(shipRes.status()).toBe(422);

    // 2. Buyer attempts '2. Simulasi Paket Tiba' (toStatus: INSPECTING)
    const inspectRes = await request.post(`http://localhost:3000/api/orders/${testOrder!.id}/transition`, {
      headers: {
        Cookie: `ngebekasinyuk_session=${buyerToken}`,
        "Content-Type": "application/json",
      },
      data: {
        toStatus: "INSPECTING",
      },
    });
    console.log("Buyer 'Simulasi Paket Tiba' HTTP Status:", inspectRes.status());
    console.log("Buyer 'Simulasi Paket Tiba' Body:", await inspectRes.text());
    expect(inspectRes.status()).toBe(422);
  });
});
