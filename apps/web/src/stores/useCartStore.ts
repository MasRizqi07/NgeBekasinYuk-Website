import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CourierService {
  id: string;
  name: string;
  service: string;
  price: number;
  etd: string;
  description: string;
}

export const AVAILABLE_COURIERS: CourierService[] = [
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
    price: 35000,
    etd: "1 - 3 Jam",
    description: "Langsung diantar kurir se-Jabodetabek",
  },
];

export interface CartItemRef {
  listingId: string;
  offerId?: string;
}

interface CartStore {
  items: CartItemRef[];
  selectedCourier: CourierService;
  selectedAddressId: string;

  addItem: (listingOrId: string | { id: string }, offerId?: string) => void;
  addToCart: (listingOrId: string | { id: string }, offerId?: string) => void;
  removeItem: (listingId: string) => void;
  removeItems: (listingIds: string[]) => void;
  clearCart: () => void;
  setSelectedCourier: (courier: CourierService) => void;
  setSelectedAddressId: (addressId: string) => void;
}

function sanitizePersistedItems(rawItems: unknown): CartItemRef[] {
  if (!Array.isArray(rawItems)) return [];
  const seen = new Set<string>();
  const sanitized: CartItemRef[] = [];

  for (const entry of rawItems) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    let listingId: string | undefined;

    if (typeof rec.listingId === "string" && rec.listingId.trim()) {
      listingId = rec.listingId.trim();
    } else if (
      rec.listing &&
      typeof rec.listing === "object" &&
      typeof (rec.listing as Record<string, unknown>).id === "string"
    ) {
      listingId = String((rec.listing as Record<string, unknown>).id).trim();
    }

    if (!listingId || seen.has(listingId)) continue;
    seen.add(listingId);

    sanitized.push({
      listingId,
      ...(typeof rec.offerId === "string" && rec.offerId.trim()
        ? { offerId: rec.offerId.trim() }
        : {}),
    });
  }

  return sanitized;
}

// Persists listing IDs only — never persist prices or listing snapshots client-side.
export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      selectedCourier: AVAILABLE_COURIERS[0],
      selectedAddressId: "addr-1",

      addItem: (listingOrId, offerId) => {
        const listingId =
          typeof listingOrId === "string" ? listingOrId : listingOrId.id;
        if (!listingId) return;

        set((state) => {
          const existing = state.items.find((i) => i.listingId === listingId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.listingId === listingId
                  ? { listingId, ...(offerId ? { offerId } : {}) }
                  : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { listingId, ...(offerId ? { offerId } : {}) },
            ],
          };
        });
      },

      addToCart: (listingOrId, offerId) => {
        get().addItem(listingOrId, offerId);
      },

      removeItem: (listingId) =>
        set((state) => ({
          items: state.items.filter((i) => i.listingId !== listingId),
        })),

      removeItems: (listingIds) => {
        const dropSet = new Set(listingIds);
        set((state) => ({
          items: state.items.filter((i) => !dropSet.has(i.listingId)),
        }));
      },

      clearCart: () => set({ items: [] }),

      setSelectedCourier: (courier) => set({ selectedCourier: courier }),
      setSelectedAddressId: (addressId) =>
        set({ selectedAddressId: addressId }),
    }),
    {
      name: "ngebekasinyuk-cart-storage",
      partialize: (state) => ({
        items: state.items.map((i) => ({
          listingId: i.listingId,
          ...(i.offerId ? { offerId: i.offerId } : {}),
        })),
        selectedCourier: state.selectedCourier,
        selectedAddressId: state.selectedAddressId,
      }),
      merge: (persistedState, currentState) => {
        const raw = (persistedState || {}) as Record<string, unknown>;
        return {
          ...currentState,
          items: sanitizePersistedItems(raw.items),
          selectedCourier:
            (raw.selectedCourier as CourierService | undefined) ||
            currentState.selectedCourier,
          selectedAddressId:
            typeof raw.selectedAddressId === "string"
              ? raw.selectedAddressId
              : currentState.selectedAddressId,
        };
      },
    }
  )
);
