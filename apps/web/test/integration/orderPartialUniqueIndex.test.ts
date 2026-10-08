import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db/prisma";
import { TERMINAL_ORDER_STATUSES } from "@/domain/listing/listingStatus";
import bcrypt from "bcryptjs";

describe("D8 Partial Unique Index Guarantee on Order(listingId) (PostgreSQL)", () => {
  let sellerId: string;
  let buyer1Id: string;
  let buyer2Id: string;

  beforeEach(async () => {
    const hashedPw = await bcrypt.hash("Password123!", 10);
    const hashedPin = await bcrypt.hash("123456", 10);
    const suffix = Math.random().toString(36).substring(2, 8);

    const seller = await prisma.user.create({
      data: {
        email: `seller-d8-${suffix}@test.id`,
        name: "D8 Seller",
        role: "SELLER",
        hashedPassword: hashedPw,
        hashedPin,
        sellerProfile: {
          create: {
            storeName: `D8 Store ${suffix}`,
            storeSlug: `d8-store-${suffix}`,
            city: "Jakarta Barat",
          },
        },
      },
    });
    sellerId = seller.id;

    const buyer1 = await prisma.user.create({
      data: {
        email: `buyer1-d8-${suffix}@test.id`,
        name: "D8 Buyer 1",
        role: "BUYER",
        hashedPassword: hashedPw,
        hashedPin,
      },
    });
    buyer1Id = buyer1.id;

    const buyer2 = await prisma.user.create({
      data: {
        email: `buyer2-d8-${suffix}@test.id`,
        name: "D8 Buyer 2",
        role: "BUYER",
        hashedPassword: hashedPw,
        hashedPin,
      },
    });
    buyer2Id = buyer2.id;
  });

  async function createListing(): Promise<string> {
    const suffix = Math.random().toString(36).substring(2, 8);
    const listing = await prisma.productListing.create({
      data: {
        slug: `d8-item-${suffix}`,
        title: `D8 Test Item ${suffix}`,
        description: "Test description",
        price: 5000000,
        originalPrice: 6000000,
        category: "smartphone",
        categoryLabel: "Smartphone",
        brand: "Apple",
        model: "iPhone 13",
        condition: "LIKE_NEW",
        canNego: false,
        status: "ACTIVE",
        sellerId,
      },
    });
    return listing.id;
  }

  it("1. pg_indexes contains order_single_active_listing_idx with exact terminal statuses matching code constant", async () => {
    const indexes: Array<{ indexname: string; indexdef: string }> = await prisma.$queryRawUnsafe(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'Order' AND indexname = 'order_single_active_listing_idx'
    `);

    expect(indexes.length).toBe(1);
    const indexDef = indexes[0].indexdef;

    // Must be unique index on listingId
    expect(indexDef).toContain('UNIQUE INDEX');
    expect(indexDef).toContain('listingId');

    // Index predicate must contain every status from TERMINAL_ORDER_STATUSES constant
    for (const status of TERMINAL_ORDER_STATUSES) {
      expect(indexDef).toContain(status);
    }
  });

  it("2. Raw second active order for the same listing fails with unique violation (P2002 / 23505)", async () => {
    const listingId = await createListing();

    // First active order
    await prisma.order.create({
      data: {
        id: `ord-d8-1-${Date.now()}`,
        orderNumber: `ORD-D8-1-${Date.now()}`,
        buyerId: buyer1Id,
        sellerId,
        listingId,
        itemPrice: 5000000,
        shippingFee: 18000,
        escrowFee: 0,
        totalAmount: 5018000,
        status: "PENDING_PAYMENT",
        shippingAddress: "Alamat 1",
      },
    });

    // Attempt raw second active order on same listing
    let caughtError: any = null;
    try {
      await prisma.order.create({
        data: {
          id: `ord-d8-2-${Date.now()}`,
          orderNumber: `ORD-D8-2-${Date.now()}`,
          buyerId: buyer2Id,
          sellerId,
          listingId,
          itemPrice: 5000000,
          shippingFee: 18000,
          escrowFee: 0,
          totalAmount: 5018000,
          status: "PENDING_PAYMENT",
          shippingAddress: "Alamat 2",
        },
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    // Prisma maps Postgres 23505 unique violation to P2002
    expect(caughtError.code).toBe("P2002");
  });

  it("3. Multiple terminal orders for the same listing do NOT violate the index", async () => {
    const listingId = await createListing();

    // Terminal order 1: CANCELLED
    await prisma.order.create({
      data: {
        id: `ord-d8-cancelled-${Date.now()}`,
        orderNumber: `ORD-D8-CAN-${Date.now()}`,
        buyerId: buyer1Id,
        sellerId,
        listingId,
        itemPrice: 5000000,
        shippingFee: 18000,
        escrowFee: 0,
        totalAmount: 5018000,
        status: "CANCELLED",
        shippingAddress: "Alamat 1",
      },
    });

    // Terminal order 2: REFUNDED
    await prisma.order.create({
      data: {
        id: `ord-d8-refunded-${Date.now()}`,
        orderNumber: `ORD-D8-REF-${Date.now()}`,
        buyerId: buyer1Id,
        sellerId,
        listingId,
        itemPrice: 5000000,
        shippingFee: 18000,
        escrowFee: 0,
        totalAmount: 5018000,
        status: "REFUNDED",
        shippingAddress: "Alamat 2",
      },
    });

    // Terminal order 3: COMPLETED
    await prisma.order.create({
      data: {
        id: `ord-d8-completed-${Date.now()}`,
        orderNumber: `ORD-D8-COM-${Date.now()}`,
        buyerId: buyer1Id,
        sellerId,
        listingId,
        itemPrice: 5000000,
        shippingFee: 18000,
        escrowFee: 0,
        totalAmount: 5018000,
        status: "COMPLETED",
        shippingAddress: "Alamat 3",
      },
    });

    // And exactly ONE active order can still be created
    const activeOrder = await prisma.order.create({
      data: {
        id: `ord-d8-active-${Date.now()}`,
        orderNumber: `ORD-D8-ACT-${Date.now()}`,
        buyerId: buyer2Id,
        sellerId,
        listingId,
        itemPrice: 5000000,
        shippingFee: 18000,
        escrowFee: 0,
        totalAmount: 5018000,
        status: "PENDING_PAYMENT",
        shippingAddress: "Alamat Active",
      },
    });

    expect(activeOrder.status).toBe("PENDING_PAYMENT");
    const count = await prisma.order.count({ where: { listingId } });
    expect(count).toBe(4);
  });
});
