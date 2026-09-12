import { describe, it, expect } from "vitest";
import {
  addMoney,
  subtractMoney,
  sumMoney,
  assertValidMoney,
  calculateEscrowBreakdown,
  formatMoneyIDR,
  MoneyDomainError,
} from "@/domain/money";

describe("Money Domain Unit Tests", () => {
  describe("assertValidMoney", () => {
    it("accepts valid non-negative integer IDR", () => {
      expect(() => assertValidMoney(0)).not.toThrow();
      expect(() => assertValidMoney(50000)).not.toThrow();
      expect(() => assertValidMoney(10000000)).not.toThrow();
    });

    it("rejects floating point values to prevent fractional penny corruption", () => {
      expect(() => assertValidMoney(15000.5)).toThrow(MoneyDomainError);
      expect(() => assertValidMoney(99.99)).toThrow(MoneyDomainError);
    });

    it("rejects negative monetary amounts", () => {
      expect(() => assertValidMoney(-1000)).toThrow(MoneyDomainError);
    });

    it("rejects non-numeric types", () => {
      expect(() => assertValidMoney("50000" as unknown as number)).toThrow(MoneyDomainError);
      expect(() => assertValidMoney(null as unknown as number)).toThrow(MoneyDomainError);
    });
  });

  describe("addMoney & sumMoney", () => {
    it("adds integers without rounding error", () => {
      expect(addMoney(7500000, 25000)).toBe(7525000);
    });

    it("sums an array of money values", () => {
      expect(sumMoney([1000000, 2000000, 500000])).toBe(3500000);
    });
  });

  describe("subtractMoney", () => {
    it("subtracts safely when minuend >= subtrahend", () => {
      expect(subtractMoney(1000000, 300000)).toBe(700000);
      expect(subtractMoney(500000, 500000)).toBe(0);
    });

    it("throws MoneyDomainError when insufficient funds (minuend < subtrahend)", () => {
      expect(() => subtractMoney(300000, 500000)).toThrow(MoneyDomainError);
    });
  });

  describe("calculateEscrowBreakdown", () => {
    it("calculates buyer total and seller payout with 0% launch fee", () => {
      const breakdown = calculateEscrowBreakdown(8500000, 30000, 0);
      expect(breakdown.itemPrice).toBe(8500000);
      expect(breakdown.shippingFee).toBe(30000);
      expect(breakdown.escrowFee).toBe(0);
      expect(breakdown.totalBuyerPays).toBe(8530000);
      expect(breakdown.sellerPayout).toBe(8500000);
    });

    it("calculates buyer total with platform fee rate", () => {
      const breakdown = calculateEscrowBreakdown(1000000, 20000, 1); // 1%
      expect(breakdown.escrowFee).toBe(10000);
      expect(breakdown.totalBuyerPays).toBe(1030000);
      expect(breakdown.sellerPayout).toBe(1000000);
    });
  });

  describe("formatMoneyIDR", () => {
    it("formats integer IDR to Indonesian locale currency string", () => {
      const formatted = formatMoneyIDR(7500000);
      expect(formatted).toContain("7.500.000");
    });
  });
});
