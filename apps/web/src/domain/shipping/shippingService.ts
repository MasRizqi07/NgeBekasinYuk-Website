// Server-Authoritative Courier & Shipping Fee Calculation
// Prevents client-side price/shipping fee tampering.

export const SERVER_COURIER_RATES: Record<string, number> = {
  "gosend instant": 45000,
  "gosend": 45000,
  "jne yes": 28000,
  "j&t express vip": 22000,
  "j&t vip": 22000,
  "sicepat best": 20000,
  "sicepat": 20000,
  "j&t express regular": 18000,
  "j&t express reguler": 18000,
  "j&t express": 18000,
  "j&t reguler": 18000,
  "jne reg": 18000,
  "jne reguler": 18000,
  "jne": 18000,
};

/**
 * Derives the official shipping fee based on courier name.
 * Normalizes input and falls back to standard ground rate (Rp 20.000) if unrecognized.
 */
export function calculateShippingFee(courierName: string): number {
  if (!courierName) return 20000;
  const normalized = courierName.toLowerCase().replace(/[^a-z0-9& ]/g, "").trim();

  for (const [key, rate] of Object.entries(SERVER_COURIER_RATES)) {
    if (normalized.includes(key)) {
      return rate;
    }
  }

  return 20000;
}
