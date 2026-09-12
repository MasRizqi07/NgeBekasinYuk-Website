import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
  OrderStatus,
  OrderStateTransitionError,
} from "@/domain/order/OrderStateMachine";

describe("Order State Machine Unit Tests", () => {
  const mockOrder = {
    id: "ord-test-1",
    buyerId: "buyer-budi",
    sellerId: "seller-dimas",
    status: "PENDING_PAYMENT" as OrderStatus,
    shippingAirwayBill: null,
    inspectionExpiresAt: null,
  };

  describe("PENDING_PAYMENT Transitions", () => {
    it("allows SYSTEM or ADMIN to confirm payment (-> FUNDED)", () => {
      const resSys = canTransition("PENDING_PAYMENT", "FUNDED", {
        actorId: "system",
        actorRole: "SYSTEM",
        order: { ...mockOrder, status: "PENDING_PAYMENT" },
      });
      expect(resSys.allowed).toBe(true);

      const resAdmin = canTransition("PENDING_PAYMENT", "FUNDED", {
        actorId: "admin-1",
        actorRole: "ADMIN",
        order: { ...mockOrder, status: "PENDING_PAYMENT" },
      });
      expect(resAdmin.allowed).toBe(true);
    });

    it("rejects BUYER or SELLER from unilaterally declaring payment funded", () => {
      const resBuyer = canTransition("PENDING_PAYMENT", "FUNDED", {
        actorId: "buyer-budi",
        actorRole: "BUYER",
        order: { ...mockOrder, status: "PENDING_PAYMENT" },
      });
      expect(resBuyer.allowed).toBe(false);
      expect(resBuyer.reason).toContain("Only payment webhook or admin");
    });

    it("allows BUYER owner to cancel unpaid order", () => {
      const res = canTransition("PENDING_PAYMENT", "CANCELLED", {
        actorId: "buyer-budi",
        actorRole: "BUYER",
        order: { ...mockOrder, status: "PENDING_PAYMENT" },
      });
      expect(res.allowed).toBe(true);
    });

    it("rejects non-owner buyer from cancelling unpaid order", () => {
      const res = canTransition("PENDING_PAYMENT", "CANCELLED", {
        actorId: "other-buyer",
        actorRole: "BUYER",
        order: { ...mockOrder, status: "PENDING_PAYMENT" },
      });
      expect(res.allowed).toBe(false);
    });
  });

  describe("FUNDED / PROCESSING / SHIPPED Transitions", () => {
    it("allows SELLER owner to mark order as SHIPPED", () => {
      const res = canTransition("FUNDED", "SHIPPED", {
        actorId: "seller-dimas",
        actorRole: "SELLER",
        order: { ...mockOrder, status: "FUNDED" },
      });
      expect(res.allowed).toBe(true);
    });

    it("rejects different seller from shipping another seller's order", () => {
      const res = canTransition("FUNDED", "SHIPPED", {
        actorId: "other-seller",
        actorRole: "SELLER",
        order: { ...mockOrder, status: "FUNDED" },
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Only seller owner");
    });

    it("allows SYSTEM to mark SHIPPED order as DELIVERED", () => {
      const res = canTransition("SHIPPED", "DELIVERED", {
        actorId: "courier-webhook",
        actorRole: "SYSTEM",
        order: { ...mockOrder, status: "SHIPPED" },
      });
      expect(res.allowed).toBe(true);
    });
  });

  describe("INSPECTING Transitions", () => {
    const inspectingOrder = {
      ...mockOrder,
      status: "INSPECTING" as OrderStatus,
      inspectionExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // In 48h
    };

    it("allows BUYER owner to confirm receipt and complete order", () => {
      const res = canTransition("INSPECTING", "COMPLETED", {
        actorId: "buyer-budi",
        actorRole: "BUYER",
        order: inspectingOrder,
      });
      expect(res.allowed).toBe(true);
    });

    it("rejects SELLER from confirming receipt on behalf of buyer", () => {
      const res = canTransition("INSPECTING", "COMPLETED", {
        actorId: "seller-dimas",
        actorRole: "SELLER",
        order: inspectingOrder,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Only buyer owner or system timeout");
    });

    it("allows BUYER owner to open dispute within inspection window", () => {
      const res = canTransition("INSPECTING", "DISPUTED", {
        actorId: "buyer-budi",
        actorRole: "BUYER",
        order: inspectingOrder,
        now: new Date(),
      });
      expect(res.allowed).toBe(true);
    });

    it("rejects opening dispute after inspection expires", () => {
      const expiredOrder = {
        ...mockOrder,
        status: "INSPECTING" as OrderStatus,
        inspectionExpiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };
      const res = canTransition("INSPECTING", "DISPUTED", {
        actorId: "buyer-budi",
        actorRole: "BUYER",
        order: expiredOrder,
        now: new Date(),
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Inspection period has expired");
    });

    it("allows SYSTEM auto-completion after inspection expired", () => {
      const expiredOrder = {
        ...mockOrder,
        status: "INSPECTING" as OrderStatus,
        inspectionExpiresAt: new Date(Date.now() - 1000),
      };
      const res = canTransition("INSPECTING", "COMPLETED", {
        actorId: "cron-auto-release",
        actorRole: "SYSTEM",
        order: expiredOrder,
        now: new Date(),
      });
      expect(res.allowed).toBe(true);
    });
  });

  describe("DISPUTED & Terminal State Invariants", () => {
    it("allows only ADMIN to decide dispute verdicts", () => {
      const disputedOrder = { ...mockOrder, status: "DISPUTED" as OrderStatus };

      const resAdmin = canTransition("DISPUTED", "RESOLVED_BUYER", {
        actorId: "admin-1",
        actorRole: "ADMIN",
        order: disputedOrder,
      });
      expect(resAdmin.allowed).toBe(true);

      const resBuyer = canTransition("DISPUTED", "RESOLVED_BUYER", {
        actorId: "buyer-budi",
        actorRole: "BUYER",
        order: disputedOrder,
      });
      expect(resBuyer.allowed).toBe(false);
      expect(resBuyer.reason).toContain("Only authorized administrator");
    });

    it("forbids altering terminal states (COMPLETED, REFUNDED, CANCELLED)", () => {
      const completedOrder = { ...mockOrder, status: "COMPLETED" as OrderStatus };
      const res = canTransition("COMPLETED", "DISPUTED", {
        actorId: "admin-1",
        actorRole: "ADMIN",
        order: completedOrder,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("terminal state");
    });

    it("assertTransition throws typed OrderStateTransitionError on invalid transition", () => {
      expect(() => {
        assertTransition("PENDING_PAYMENT", "COMPLETED", {
          actorId: "buyer-budi",
          actorRole: "BUYER",
          order: mockOrder,
        });
      }).toThrow(OrderStateTransitionError);
    });
  });
});
