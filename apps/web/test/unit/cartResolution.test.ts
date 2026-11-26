import { describe, it, expect } from "vitest";
import {
  chunkIds,
  partitionResolvedCartBatches,
} from "@/hooks/useResolvedCartListings";
import type { ProductListing } from "@/types";

function makeListing(id: string, status: ProductListing["status"] = "ACTIVE"): ProductListing {
  return {
    id,
    slug: `slug-${id}`,
    title: `Listing ${id}`,
    description: "Deskripsi barang",
    price: 1500000,
    condition: "LIKE_NEW",
    conditionLabel: "Seperti Baru",
    conditionScore: 99,
    category: "smartphone",
    categoryLabel: "Smartphone",
    brand: "Apple",
    model: "iPhone",
    images: ["/assets/products/ipad-mini-unboxing.png"],
    specifications: {},
    completeness: ["Unit"],
    diagnosticPassed: true,
    sellerId: "seller-1",
    seller: {
      id: "seller-1",
      name: "Seller 1",
      avatar: "/assets/avatars/seller-default.png",
      trustScore: 95,
      rating: 5,
      reviewCount: 1,
      verifiedKYC: true,
      location: "Jakarta",
      city: "Jakarta",
      joinedDate: "2026-01-01",
      responseTime: "< 1 jam",
      successTransactions: 1,
    },
    location: "Jakarta",
    city: "Jakarta",
    createdAt: new Date().toISOString(),
    viewsCount: 0,
    favoritesCount: 0,
    canNego: true,
    status,
  };
}

describe("Cart Lookup Batching & Error Preservation (PR #24 Regression)", () => {
  it("chunks > 20 cart IDs into batches of at most 20", () => {
    const ids = Array.from({ length: 45 }, (_, idx) => `item-${idx + 1}`);
    const batches = chunkIds(ids, 20);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(20);
    expect(batches[1]).toHaveLength(20);
    expect(batches[2]).toHaveLength(5);
  });

  it("preserves cart items when API returns HTTP 500 or malformed JSON", () => {
    const result = partitionResolvedCartBatches([
      {
        batch: ["id-1", "id-2"],
        ok: false,
        json: { error: "INTERNAL_SERVER_ERROR" },
      },
      {
        batch: ["id-3"],
        ok: true,
        json: null,
      },
    ]);

    expect(result.hasLookupError).toBe(true);
    expect(result.confirmedUnavailableIds).toEqual([]);
    expect(result.activeMap.size).toBe(0);
  });

  it("only drops confirmed unavailable IDs from valid 200 list responses", () => {
    const activeListing = makeListing("id-1", "ACTIVE");
    const result = partitionResolvedCartBatches([
      {
        batch: ["id-1", "id-2"],
        ok: true,
        json: { object: "list", data: [activeListing] },
      },
      {
        batch: ["id-3", "id-4"],
        ok: false,
        json: { error: "RATE_LIMITED" },
      },
    ]);

    expect(result.hasLookupError).toBe(true);
    expect(result.confirmedUnavailableIds).toEqual(["id-2"]);
    expect(result.activeMap.get("id-1")?.id).toBe("id-1");
  });
});
