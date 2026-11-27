import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  COURIER_CATALOG,
  type CourierService,
} from "@/domain/shipping/shippingService";

export type { CourierService };
export const AVAILABLE_COURIERS: CourierService[] = COURIER_CATALOG;

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
      merge: mergePersistedCartState,
    }
  )
);

/**
 * Reconciles persisted cart state against the authoritative shipping catalog so stale localStorage rates never override server rates.
 */
export function mergePersistedCartState(
  persistedState: unknown,
  currentState: CartStore
): CartStore {
  const raw = (persistedState || {}) as Record<string, unknown>;
  const persistedCourier = raw.selectedCourier as
    | Partial<CourierService>
    | undefined;
  // Reconcile persisted courier price/metadata against authoritative catalog so stale rates never linger
  const matchedCourier = persistedCourier?.id
    ? AVAILABLE_COURIERS.find((c) => c.id === persistedCourier.id)
    : undefined;

  return {
    ...currentState,
    items: sanitizePersistedItems(raw.items),
    selectedCourier: matchedCourier || currentState.selectedCourier,
    selectedAddressId:
      typeof raw.selectedAddressId === "string"
        ? raw.selectedAddressId
        : currentState.selectedAddressId,
  };
}
