import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { signSession } from "@/lib/auth/session";
import { prisma } from "@/server/db/prisma";

test.describe("Phase 11 Live Chat, Price Negotiation & Checkout E2E (AC11.3 & AC11.10)", () => {
  test("two-browser live polling <= 6s, plain XSS safety, counter/accept flow, and negotiated escrow checkout", async ({
    browser,
  }) => {
    const suffix = crypto.randomBytes(4).toString("hex");
    const createdUserIds: string[] = [];
    const createdListingIds: string[] = [];

    const seller = await prisma.user.create({
      data: {
        email: `e2e-chat-seller-${suffix}@test.id`,
        name: `Seller E2E ${suffix}`,
        role: "SELLER",
        isVerified: true,
        hashedPassword: "SENTINEL_HASHED_PASSWORD",
        hashedPin: "SENTINEL_HASHED_PIN",
        accountStatus: "ACTIVE",
        sessionVersion: 1,
        sellerProfile: {
          create: {
            storeName: `E2E Gadget Store ${suffix}`,
            storeSlug: `e2e-store-${suffix}`,
            city: "Jakarta Selatan",
          },
        },
      },
    });
    createdUserIds.push(seller.id);

    const buyer = await prisma.user.create({
      data: {
        email: `e2e-chat-buyer-${suffix}@test.id`,
        name: `Buyer E2E ${suffix}`,
        role: "BUYER",
        isVerified: true,
        hashedPassword: "SENTINEL_HASHED_PASSWORD",
        hashedPin: "SENTINEL_HASHED_PIN",
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      },
    });
    createdUserIds.push(buyer.id);

    const listing = await prisma.productListing.create({
      data: {
        id: `list-e2e-chat-${suffix}`,
        slug: `e2e-sony-zv-e10-${suffix}`,
        title: `E2E Sony ZV-E10 Kit ${suffix}`,
        description: "Kamera vlogging mulus shutter rendah garansi resmi.",
        price: 7000000,
        canNego: true,
        category: "camera",
        categoryLabel: "Kamera",
        brand: "Sony",
        model: "ZV-E10",
        condition: "LIKE_NEW",
        status: "ACTIVE",
        sellerId: seller.id,
      },
    });
    createdListingIds.push(listing.id);

    const sellerToken = await signSession({
      id: seller.id,
      email: seller.email,
      name: seller.name,
      role: "SELLER",
      isVerified: true,
      sessionVersion: 1,
    });
    const buyerToken = await signSession({
      id: buyer.id,
      email: buyer.email,
      name: buyer.name,
      role: "BUYER",
      isVerified: true,
      sessionVersion: 1,
    });

    const sellerContext = await browser.newContext();
    const buyerContext = await browser.newContext();

    try {
      await sellerContext.addCookies([
        {
          name: "ngebekasinyuk_session",
          value: sellerToken,
          domain: "localhost",
          path: "/",
        },
      ]);
      await buyerContext.addCookies([
        {
          name: "ngebekasinyuk_session",
          value: buyerToken,
          domain: "localhost",
          path: "/",
        },
      ]);

      const buyerPage = await buyerContext.newPage();
      const sellerPage = await sellerContext.newPage();

      // 1. Buyer opens listing detail and starts chat + submits initial offer via modal
      await buyerPage.goto(`/product/${listing.slug}`);
      await expect(
        buyerPage.getByRole("heading", { name: listing.title })
      ).toBeVisible({ timeout: 15_000 });

      await buyerPage.getByRole("button", { name: /Tawar Harga/i }).click();
      await buyerPage.locator('input[type="number"]').fill("5500000");
      await buyerPage
        .getByRole("button", { name: /Kirim Penawaran ke Chat/i })
        .click();

      await buyerPage.waitForURL(/\/chat\/conv-/, { timeout: 15_000 });
      const convoUrl = buyerPage.url();
      const convoId = convoUrl.split("/chat/").pop()!.split("?")[0];

      // Seller opens same thread cleanly
      await sellerPage.goto(`/chat/${convoId}`);
      await expect(sellerPage.getByText(/Rp\s*5\.500\.000/)).toBeVisible({
        timeout: 10_000,
      });

      // 2. AC11.3 & AC11.10: Buyer sends literal <script> payload; seller receives it within 6s without reload and no JS runs
      const xssMessage =
        'Halo ready kak? <script>window.__xssExecuted = true;</script>';
      await buyerPage.getByLabel("Tulis pesan chat").fill(xssMessage);
      await buyerPage.getByRole("button", { name: /Kirim/i }).click();

      // Buyer sees plain text and XSS never executes
      await expect(buyerPage.getByText(xssMessage)).toBeVisible({
        timeout: 5_000,
      });
      expect(
        await buyerPage.evaluate(
          () => (window as unknown as { __xssExecuted?: boolean }).__xssExecuted
        )
      ).toBeUndefined();

      // AC11.10: Seller sees buyer message within 6 seconds WITHOUT reload!
      await expect(sellerPage.getByText(xssMessage)).toBeVisible({
        timeout: 6_000,
      });
      expect(
        await sellerPage.evaluate(
          () => (window as unknown as { __xssExecuted?: boolean }).__xssExecuted
        )
      ).toBeUndefined();

      // 3. Seller counters offer (5.5M -> 6.1M), buyer sees counter within 6s without reload
      await sellerPage.getByRole("button", { name: /Tawar Balik/i }).click();
      await sellerPage.getByLabel("Nominal harga tanding").fill("6100000");
      await sellerPage
        .getByRole("button", { name: /Kirim Harga Tanding/i })
        .click();

      await expect(
        buyerPage.getByRole("button", { name: /Ajukan Harga Penjual/i })
      ).toBeVisible({ timeout: 6_000 });

      // Buyer submits the counter price (6.1M), seller accepts it, buyer sees "Beli Sekarang (Harga Nego)" within 6s
      await buyerPage
        .getByRole("button", { name: /Ajukan Harga Penjual/i })
        .click();

      const acceptBtn = sellerPage.getByRole("button", { name: /^Terima$/ });
      await expect(acceptBtn).toBeVisible({ timeout: 6_000 });
      await acceptBtn.click();

      const buyNegoBtn = buyerPage
        .getByRole("button", { name: /Beli Sekarang \(Harga Nego\)/i })
        .first();
      await expect(buyNegoBtn).toBeVisible({ timeout: 6_000 });
      await buyNegoBtn.click();

      // 4. Negotiated escrow checkout verifies offer price Rp 6.100.000
      await buyerPage.waitForURL(/\/checkout/, { timeout: 15_000 });
      await expect(buyerPage.getByText(/Harga Nego Disetujui/i)).toBeVisible({
        timeout: 10_000,
      });
      await expect(buyerPage.getByText(/Rp\s*6\.100\.000/).first()).toBeVisible();

      await buyerPage
        .getByRole("button", { name: /Bayar dengan Escrow/i })
        .click();
      await buyerPage.waitForURL(/\/payment\/.*\/pending/, { timeout: 15_000 });

      const dbOrder = await prisma.order.findFirst({
        where: { listingId: listing.id },
      });
      expect(dbOrder).not.toBeNull();
      expect(dbOrder?.itemPrice).toBe(6100000);
      expect(dbOrder?.offerId).toBeTruthy();

      const dbOffer = await prisma.priceOffer.findUniqueOrThrow({
        where: { id: dbOrder!.offerId! },
      });
      expect(dbOffer.status).toBe("CONSUMED");
    } finally {
      await buyerContext.close();
      await sellerContext.close();

      // Clean up test DB artifacts
      const orders = await prisma.order.findMany({
        where: { listingId: { in: createdListingIds } },
        select: { id: true },
      });
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length > 0) {
        await prisma.escrowAccount.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await prisma.paymentAttempt.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await prisma.orderStatusHistory.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      }

      const convos = await prisma.conversation.findMany({
        where: { listingId: { in: createdListingIds } },
        select: { id: true },
      });
      const convoIds = convos.map((c) => c.id);
      if (convoIds.length > 0) {
        await prisma.chatMessage.deleteMany({
          where: { conversationId: { in: convoIds } },
        });
        await prisma.priceOffer.deleteMany({
          where: { conversationId: { in: convoIds } },
        });
        await prisma.conversation.deleteMany({ where: { id: { in: convoIds } } });
      }

      if (createdListingIds.length > 0) {
        await prisma.productListing.deleteMany({
          where: { id: { in: createdListingIds } },
        });
      }
      if (createdUserIds.length > 0) {
        await prisma.auditLog.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await prisma.sellerProfile.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
    }
  });
});
