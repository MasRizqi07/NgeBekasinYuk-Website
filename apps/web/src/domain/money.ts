// NgeBekasinYuk Financial Money Model
// Invariant: Monetary calculations use non-negative safe integers in Indonesian Rupiah (IDR).
// Floating-point representations and formatted strings must never enter the domain calculation layer.

export type Money = number; // Safe integer in IDR

export class MoneyDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyDomainError";
  }
}

/**
 * Validates that an amount is a safe, non-negative integer representing Indonesian Rupiah.
 */
export function assertValidMoney(amount: unknown, fieldName = "amount"): asserts amount is Money {
  if (typeof amount !== "number" || !Number.isInteger(amount)) {
    throw new MoneyDomainError(`Invalid ${fieldName}: must be an integer, received ${typeof amount === "number" ? amount : typeof amount}`);
  }
  if (!Number.isSafeInteger(amount)) {
    throw new MoneyDomainError(`Invalid ${fieldName}: exceeds safe integer limit`);
  }
  if (amount < 0) {
    throw new MoneyDomainError(`Invalid ${fieldName}: monetary amount cannot be negative (${amount})`);
  }
}

/**
 * Safely adds two monetary amounts.
 */
export function addMoney(a: Money, b: Money): Money {
  assertValidMoney(a, "first addend");
  assertValidMoney(b, "second addend");
  const sum = a + b;
  assertValidMoney(sum, "sum result");
  return sum;
}

/**
 * Safely subtracts subtrahend from minuend. Enforces non-negative balance invariant.
 */
export function subtractMoney(minuend: Money, subtrahend: Money): Money {
  assertValidMoney(minuend, "minuend");
  assertValidMoney(subtrahend, "subtrahend");
  if (minuend < subtrahend) {
    throw new MoneyDomainError(
      `Insufficient funds: cannot subtract ${subtrahend} from ${minuend}`
    );
  }
  return minuend - subtrahend;
}

/**
 * Sums an array of money values.
 */
export function sumMoney(amounts: Money[]): Money {
  return amounts.reduce((acc, curr) => addMoney(acc, curr), 0);
}

/**
 * Splits an amount into platform fee and seller payout.
 * Platform fee is 0% during promo launching, but configurable.
 */
export function calculateEscrowBreakdown(
  itemPrice: Money,
  shippingFee: Money,
  escrowFeeRatePercent = 0
): {
  itemPrice: Money;
  shippingFee: Money;
  escrowFee: Money;
  totalBuyerPays: Money;
  sellerPayout: Money;
} {
  assertValidMoney(itemPrice, "itemPrice");
  assertValidMoney(shippingFee, "shippingFee");

  const escrowFee = Math.round((itemPrice * escrowFeeRatePercent) / 100);
  assertValidMoney(escrowFee, "escrowFee");

  const totalBuyerPays = addMoney(addMoney(itemPrice, shippingFee), escrowFee);
  const sellerPayout = itemPrice; // Seller receives 100% of item price

  return {
    itemPrice,
    shippingFee,
    escrowFee,
    totalBuyerPays,
    sellerPayout,
  };
}

/**
 * Presentation helper: format integer IDR to Indonesian locale string.
 * This should ONLY be called at the UI/presentation boundary.
 */
export function formatMoneyIDR(amount: Money): string {
  assertValidMoney(amount);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/\s+/g, " ");
}
