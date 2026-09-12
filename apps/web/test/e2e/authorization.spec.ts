import { test, expect } from "@playwright/test";
import { signSession } from "@/lib/auth/session";

test.describe("Object-Level Authorization & IDOR Defenses (HP2-P1-02)", () => {
  test("non-admin calling /api/disputes/[id]/verdict is rejected with 403 FORBIDDEN", async ({ request }) => {
    const buyerToken = await signSession({
      id: "usr-buyer-budi",
      email: "buyer@ngebekasinyuk.id",
      name: "Budi Pratama",
      role: "BUYER",
      isVerified: true,
    });

    const response = await request.post("/api/disputes/dsp-iphone-13/verdict", {
      headers: {
        Cookie: `ngebekasinyuk_session=${buyerToken}`,
        "Content-Type": "application/json",
      },
      data: {
        verdict: "REFUND_BUYER",
        adminNotes: "Malicious non-admin verdict attempt",
        stepUpCode: "123456",
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("FORBIDDEN");
  });

  test("non-admin calling /api/admin/step-up is rejected with 403 FORBIDDEN", async ({ request }) => {
    const buyerToken = await signSession({
      id: "usr-buyer-budi",
      email: "buyer@ngebekasinyuk.id",
      name: "Budi Pratama",
      role: "BUYER",
      isVerified: true,
    });

    const response = await request.post("/api/admin/step-up", {
      headers: {
        Cookie: `ngebekasinyuk_session=${buyerToken}`,
        "Content-Type": "application/json",
      },
      data: {
        code: "123456",
      },
    });

    expect(response.status()).toBe(403);
  });

  test("seller attempting to self-release their own escrow is forbidden", async ({ request }) => {
    const sellerToken = await signSession({
      id: "usr-seller-dimas",
      email: "seller@ngebekasinyuk.id",
      name: "Dimas Aditya",
      role: "SELLER",
      isVerified: true,
    });

    const response = await request.post("/api/orders/ord-inspecting-1/transition", {
      headers: {
        Cookie: `ngebekasinyuk_session=${sellerToken}`,
        "Content-Type": "application/json",
      },
      data: {
        targetStatus: "COMPLETED",
        reason: "Seller trying to force complete and release escrow",
      },
    });

    // Seller is forbidden from self-releasing their own escrow
    expect([400, 403, 422]).toContain(response.status());
  });
});
