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

const MAX_LOOKUP_BATCH_SIZE = 20;

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

export function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

export interface CartBatchLookupResult {
  batch: string[];
  ok: boolean;
  json: unknown;
}

export function partitionResolvedCartBatches(results: CartBatchLookupResult[]): {
  activeMap: Map<string, ProductListing>;
  confirmedUnavailableIds: string[];
  hasLookupError: boolean;
} {
  const activeMap = new Map<string, ProductListing>();
  const confirmedUnavailableIds: string[] = [];
  let hasLookupError = false;

  for (const result of results) {
    const payload = result.json as { object?: unknown; data?: unknown } | null;
    const isValidEnvelope =
      result.ok &&
      payload !== null &&
      typeof payload === "object" &&
      payload.object === "list" &&
      Array.isArray(payload.data);

    if (!isValidEnvelope) {
      hasLookupError = true;
      continue;
    }

    const batchActiveMap = new Map<string, ProductListing>();
    for (const entry of payload.data as ProductListing[]) {
      if (!entry.status || entry.status === "ACTIVE") {
        batchActiveMap.set(entry.id, entry);
        activeMap.set(entry.id, entry);
      }
    }

    for (const id of result.batch) {
      if (!batchActiveMap.has(id)) {
        confirmedUnavailableIds.push(id);
      }
    }
  }

  return { activeMap, confirmedUnavailableIds, hasLookupError };
}

/**
 * Fetches live PostgreSQL listing data for listing IDs stored in useCartStore.
 * Batches lookups <= 20 IDs, preserves IDs on lookup errors, and removes only
 * confirmed non-ACTIVE items when the API explicitly succeeds.
 */
export function useResolvedCartListings(options?: {
  fallbackToFirstActive?: boolean;
  targetListingId?: string | null;
}): ResolvedCartState {
  const fallbackToFirstActive = options?.fallbackToFirstActive ?? false;
  const targetListingId = options?.targetListingId?.trim() || null;
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
      const storedIds = items.map((i) => i.listingId);
      const ids =
        targetListingId && !storedIds.includes(targetListingId)
          ? [targetListingId, ...storedIds]
          : storedIds;

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
          const json = await res.json().catch(() => null);
          if (!cancelled) {
            setListings(res.ok && Array.isArray(json?.data) ? json.data : []);
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
        const batches = chunkIds(ids, MAX_LOOKUP_BATCH_SIZE);
        const batchResults = await Promise.all(
          batches.map(async (batch) => {
            const res = await fetch(
              `/api/listings?ids=${encodeURIComponent(batch.join(","))}&limit=${batch.length}`,
              { cache: "no-store" }
            );
            const json = await res.json().catch(() => null);
            return { batch, ok: res.ok, json };
          })
        );

        const { activeMap, confirmedUnavailableIds, hasLookupError } =
          partitionResolvedCartBatches(batchResults);

        const droppedStoredIds = confirmedUnavailableIds.filter((id) =>
          storedIds.includes(id)
        );

        if (!cancelled && droppedStoredIds.length > 0) {
          hadDroppedRef.current = true;
          removeItems(droppedStoredIds);
          setDroppedNotice(
            `${droppedStoredIds.length} barang di keranjang tidak lagi tersedia (terjual, dipesan, atau diarsipkan) dan telah otomatis dihapus.`
          );
        } else if (!cancelled && hasLookupError) {
          setDroppedNotice(
            "Gagal memverifikasi sebagian isi keranjang karena gangguan server. Item Anda tetap disimpan, silakan muat ulang."
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
          setDroppedNotice(
            "Koneksi gagal saat memeriksa ketersediaan keranjang. Item Anda tetap disimpan."
          );
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    itemIdsKey,
    targetListingId,
    fallbackToFirstActive,
    removeItems,
    items,
  ]);

  return {
    listings,
    isLoading,
    droppedNotice,
    clearDroppedNotice: () => setDroppedNotice(null),
  };
}
