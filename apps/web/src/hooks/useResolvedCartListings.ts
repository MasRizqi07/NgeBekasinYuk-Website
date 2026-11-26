"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useCartStore } from "@/stores/useCartStore";
import type { ProductListing } from "@/types";

export interface ResolvedCartState {
  listings: ProductListing[];
  isLoading: boolean;
  droppedNotice: string | null;
  clearDroppedNotice: () => void;
}

const subscribeCartHydration = (onStoreChange: () => void) => {
  const api = (
    useCartStore as unknown as {
      persist?: {
        onFinishHydration?: (cb: () => void) => () => void;
      };
    }
  ).persist;
  return api?.onFinishHydration?.(onStoreChange) ?? (() => {});
};

const getCartHydratedSnapshot = () => {
  const api = (
    useCartStore as unknown as {
      persist?: {
        hasHydrated?: () => boolean;
      };
    }
  ).persist;
  return api?.hasHydrated?.() ?? true;
};

/**
 * Fetches live PostgreSQL listing data for listing IDs stored in useCartStore.
 * Automatically drops SOLD, RESERVED, or ARCHIVED items with a visible notice.
 */
export function useResolvedCartListings(options?: {
  fallbackToFirstActive?: boolean;
}): ResolvedCartState {
  const fallbackToFirstActive = options?.fallbackToFirstActive ?? false;
  const { items, removeItems } = useCartStore();
  const hydrated = useSyncExternalStore(
    subscribeCartHydration,
    getCartHydratedSnapshot,
    () => false
  );
  const [listings, setListings] = useState<ProductListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [droppedNotice, setDroppedNotice] = useState<string | null>(null);
  const hadDroppedRef = useRef(false);

  const itemIdsKey = items.map((i) => i.listingId).join(",");

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    async function load() {
      const ids = items.map((i) => i.listingId);

      if (ids.length === 0) {
        if (!fallbackToFirstActive || hadDroppedRef.current) {
          if (!cancelled) {
            setListings([]);
            setIsLoading(false);
          }
          return;
        }

        try {
          const res = await fetch("/api/listings?limit=1", { cache: "no-store" });
          const json = await res.json();
          if (!cancelled) {
            setListings(Array.isArray(json?.data) ? json.data : []);
            setIsLoading(false);
          }
        } catch {
          if (!cancelled) {
            setListings([]);
            setIsLoading(false);
          }
        }
        return;
      }

      try {
        const res = await fetch(
          `/api/listings?ids=${encodeURIComponent(ids.join(","))}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        const activeList: ProductListing[] = Array.isArray(json?.data)
          ? json.data.filter(
              (item: ProductListing) => !item.status || item.status === "ACTIVE"
            )
          : [];

        const activeMap = new Map(activeList.map((item) => [item.id, item]));
        const unavailableIds = ids.filter((id) => !activeMap.has(id));

        if (!cancelled && unavailableIds.length > 0) {
          hadDroppedRef.current = true;
          removeItems(unavailableIds);
          setDroppedNotice(
            `${unavailableIds.length} barang di keranjang tidak lagi tersedia (terjual, dipesan, atau diarsipkan) dan telah otomatis dihapus.`
          );
        }

        if (!cancelled) {
          const ordered = ids
            .map((id) => activeMap.get(id))
            .filter((item): item is ProductListing => Boolean(item));
          setListings(ordered);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setListings([]);
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, itemIdsKey, fallbackToFirstActive, removeItems, items]);

  return {
    listings,
    isLoading,
    droppedNotice,
    clearDroppedNotice: () => setDroppedNotice(null),
  };
}
