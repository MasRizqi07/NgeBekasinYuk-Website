// Server-Authoritative Courier & Shipping Fee Calculation
// Single source of truth shared between checkout UI catalog and server order calculation.

export interface CourierService {
  id: string;
  name: string;
  service: string;
  price: number;
  etd: string;
  description: string;
}

export const COURIER_CATALOG: CourierService[] = [
  {
    id: "jnt-vip",
    name: "J&T Express",
    service: "VIP Fast",
    price: 22000,
    etd: "1 - 2 Hari",
    description: "Prioritas aman untuk gadget berharga",
  },
  {
    id: "jne-yes",
    name: "JNE",
    service: "YES (Yakin Esok Sampai)",
    price: 28000,
    etd: "Besok Tiba",
    description: "Pengiriman kilat 24 jam sampai",
  },
  {
    id: "sicepat-best",
    name: "SiCepat",
    service: "BEST",
    price: 20000,
    etd: "1 - 2 Hari",
    description: "Garansi penanganan aman",
  },
  {
    id: "gosend-instant",
    name: "GoSend",
    service: "Instant Motor",
    price: 45000,
    etd: "1 - 3 Jam",
    description: "Langsung diantar kurir se-Jabodetabek",
  },
];

export const SERVER_COURIER_RATES: Record<string, number> = {
  "gosend instant": 45000,
  gosend: 45000,
  "jne yes": 28000,
  "j&t express vip": 22000,
  "j&t vip": 22000,
  "sicepat best": 20000,
  sicepat: 20000,
  "j&t express regular": 18000,
  "j&t express reguler": 18000,
  "j&t express": 18000,
  "j&t reguler": 18000,
  "jne reg": 18000,
  "jne reguler": 18000,
  jne: 18000,
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
