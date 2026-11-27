import { describe, it, expect, beforeEach } from "vitest";
import { resolveSafeRedirectPath } from "@/lib/auth/redirect";
import { calculateShippingFee, COURIER_CATALOG } from "@/domain/shipping/shippingService";
import { AVAILABLE_COURIERS, mergePersistedCartState, useCartStore } from "@/stores/useCartStore";
import { mergeUserState, partializeUserState, useUserStore } from "@/stores/useUserStore";

describe("QA Critical Fixes Unit Regressions", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], selectedCourier: AVAILABLE_COURIERS[0] });
    useUserStore.setState((s) => ({
      ...s,
      isLoggedIn: false,
      authStatus: "unauthenticated",
    }));
  });

  it("resolveSafeRedirectPath preserves internal relative paths and blocks open redirects", () => {
    expect(resolveSafeRedirectPath("/orders")).toBe("/orders");
    expect(resolveSafeRedirectPath("/product/sony-a7-iii?tab=specs")).toBe(
      "/product/sony-a7-iii?tab=specs"
    );
    expect(resolveSafeRedirectPath("/admin/dashboard")).toBe("/admin/dashboard");

    expect(resolveSafeRedirectPath(null)).toBe("/");
    expect(resolveSafeRedirectPath("")).toBe("/");
    expect(resolveSafeRedirectPath("https://evil.example/steal")).toBe("/");
    expect(resolveSafeRedirectPath("//evil.example/steal")).toBe("/");
    expect(resolveSafeRedirectPath("/\\evil.example")).toBe("/");
    expect(resolveSafeRedirectPath("/login")).toBe("/");
    expect(resolveSafeRedirectPath("/login?next=/orders")).toBe("/");
    expect(resolveSafeRedirectPath("/register")).toBe("/");
  });

  it("GoSend and all AVAILABLE_COURIERS share exact server rates via COURIER_CATALOG", () => {
    expect(AVAILABLE_COURIERS).toEqual(COURIER_CATALOG);
    const gosend = AVAILABLE_COURIERS.find((c) => c.id === "gosend-instant");
    expect(gosend?.price).toBe(45000);

    for (const courier of AVAILABLE_COURIERS) {
      expect(calculateShippingFee(`${courier.name} ${courier.service}`)).toBe(
        courier.price
      );
    }
  });

  it("useCartStore merge refreshes stale cached GoSend rate (35000 -> 45000)", () => {
    const current = useCartStore.getState();
    const merged = mergePersistedCartState(
      {
        items: [{ listingId: "prod-1" }],
        selectedCourier: {
          id: "gosend-instant",
          name: "GoSend",
          service: "Instant Motor",
          price: 35000,
          etd: "1 - 3 Jam",
          description: "stale",
        },
      },
      current
    );

    expect(merged.selectedCourier.id).toBe("gosend-instant");
    expect(merged.selectedCourier.price).toBe(45000);
  });

  it("useUserStore defaults unauthenticated without fake identity and partializes auth out of storage", () => {
    const initial = useUserStore.getState();
    expect(initial.isLoggedIn).toBe(false);
    expect(initial.user.name).toBe("");
    expect(initial.user.name).not.toBe("Budi Pratama");
    expect(initial.user.isKYCVerified).toBe(false);

    initial.setAuthenticatedUser({
      id: "usr-seller-1",
      email: "seller@test.id",
      name: "Dimas Aditya",
      role: "SELLER",
      isVerified: true,
    });

    const persisted = partializeUserState(useUserStore.getState()) as Record<string, unknown>;
    expect(persisted.isLoggedIn).toBeUndefined();
    expect(persisted.user).toBeUndefined();
    expect(Array.isArray(persisted.addresses)).toBe(true);
    expect(Array.isArray(persisted.favorites)).toBe(true);

    const rehydrated = mergeUserState(
      {
        isLoggedIn: true,
        user: { name: "Budi Pratama", isKYCVerified: true },
        addresses: [{ id: "addr-custom", label: "Kantor", recipientName: "Dimas", phone: "0812", fullAddress: "Jl. Test", city: "Jakarta", isDefault: true }],
        favorites: ["prod-42"],
      },
      initial
    );
    expect(rehydrated.isLoggedIn).toBe(false);
    expect(rehydrated.authStatus).toBe("loading");
    expect(rehydrated.user.name).toBe("");
    expect(rehydrated.user.isKYCVerified).toBe(false);
    expect(rehydrated.user.addresses).toHaveLength(1);
    expect(rehydrated.user.addresses[0].id).toBe("addr-custom");
    expect(rehydrated.user.favorites).toEqual(["prod-42"]);
  });
});
