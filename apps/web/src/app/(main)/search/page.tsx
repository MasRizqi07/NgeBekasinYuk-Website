"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  SlidersHorizontal,
  ArrowUpDown,
  X,
  ShieldCheck,
  Check,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import type { ProductListing } from "@/types";
import { useListingStore } from "@/stores/useListingStore";
import { ListingCard } from "@/components/features/ListingCard";
import { FilterSheet } from "@/components/features/FilterSheet";
import { Button } from "@/components/ui/Button";

function mapSortToApi(sortBy: string): "newest" | "price_asc" | "price_desc" | "popular" {
  switch (sortBy) {
    case "price_low":
      return "price_asc";
    case "price_high":
      return "price_desc";
    case "newest":
      return "newest";
    case "relevant":
    default:
      return "popular";
  }
}

function SearchContent() {
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("q") || "";
  const categoryParam = searchParams.get("category");
  const canNegoParam = searchParams.get("canNego");

  const {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedConditions,
    toggleCondition,
    minPrice,
    maxPrice,
    selectedCity,
    setSelectedCity,
    verifiedSellerOnly,
    toggleVerifiedSellerOnly,
    canNegoOnly,
    toggleCanNegoOnly,
    sortBy,
    setSortBy,
    resetFilters,
  } = useListingStore();

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [listings, setListings] = useState<ProductListing[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Sync URL params to filter store on URL change
  useEffect(() => {
    if (queryParam) setSearchQuery(queryParam);
    if (categoryParam) setSelectedCategory(categoryParam);
    if (canNegoParam === "true" && !canNegoOnly) toggleCanNegoOnly();
  }, [queryParam, categoryParam, canNegoParam, canNegoOnly, setSearchQuery, setSelectedCategory, toggleCanNegoOnly]);

  const buildQueryString = useCallback(
    (cursor?: string | null) => {
      const qs = new URLSearchParams();
      if (searchQuery.trim()) qs.set("q", searchQuery.trim());
      if (selectedCategory && selectedCategory !== "all") {
        qs.set("category", selectedCategory);
      }
      if (selectedConditions.length > 0) {
        qs.set("condition", selectedConditions.join(","));
      }
      if (minPrice !== null) qs.set("minPrice", String(minPrice));
      if (maxPrice !== null) qs.set("maxPrice", String(maxPrice));
      if (selectedCity && selectedCity !== "Semua Kota") {
        qs.set("city", selectedCity);
      }
      if (canNegoOnly) qs.set("canNego", "true");
      if (verifiedSellerOnly) qs.set("verifiedOnly", "true");
      qs.set("sort", mapSortToApi(sortBy));
      qs.set("limit", "12");
      if (cursor) qs.set("cursor", cursor);
      return qs.toString();
    },
    [
      searchQuery,
      selectedCategory,
      selectedConditions,
      minPrice,
      maxPrice,
      selectedCity,
      canNegoOnly,
      verifiedSellerOnly,
      sortBy,
    ]
  );

  useEffect(() => {
    let cancelled = false;
    async function fetchCatalog() {
      try {
        const res = await fetch(`/api/listings?${buildQueryString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!cancelled) {
          setListings(Array.isArray(json?.data) ? json.data : []);
          setNextCursor(json?.pagination?.nextCursor ?? null);
          setHasMore(Boolean(json?.pagination?.hasMore));
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setListings([]);
          setNextCursor(null);
          setHasMore(false);
          setIsLoading(false);
        }
      }
    }

    void fetchCatalog();
    return () => {
      cancelled = true;
    };
  }, [buildQueryString]);

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/listings?${buildQueryString(nextCursor)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      const incoming: ProductListing[] = Array.isArray(json?.data) ? json.data : [];
      setListings((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const merged = [...prev];
        for (const item of incoming) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            merged.push(item);
          }
        }
        return merged;
      });
      setNextCursor(json?.pagination?.nextCursor ?? null);
      setHasMore(Boolean(json?.pagination?.hasMore));
    } finally {
      setIsLoadingMore(false);
    }
  };

  let activeFilterCount = 0;
  if (selectedCategory && selectedCategory !== "all") activeFilterCount++;
  activeFilterCount += selectedConditions.length;
  if (minPrice !== null || maxPrice !== null) activeFilterCount++;
  if (selectedCity) activeFilterCount++;
  if (verifiedSellerOnly) activeFilterCount++;
  if (canNegoOnly) activeFilterCount++;

  const sortOptions = [
    { id: "relevant", label: "Paling Sesuai" },
    { id: "price_low", label: "Harga Terendah" },
    { id: "price_high", label: "Harga Tertinggi" },
    { id: "newest", label: "Terbaru Listing" },
  ] as const;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-4">
      {/* 1. Header Query Title & Active Count */}
      <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-secondary" />
            <h1 className="font-extrabold text-base sm:text-lg text-on-surface">
              {searchQuery ? `Hasil Pencarian: "${searchQuery}"` : "Katalog Gadget Bekas Teruji"}
            </h1>
          </div>
          <span className="bg-brand-secondary-light text-brand-secondary text-xs font-bold px-2.5 py-1 rounded-full">
            {listings.length} Gadget Aman
          </span>
        </div>

        {/* 2. Active Dismissible Filter Pills */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-surface-border">
            {selectedCategory !== "all" && (
              <span className="inline-flex items-center gap-1 bg-brand-primary-soft text-brand-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                <span>Kategori: {selectedCategory}</span>
                <button
                  onClick={() => setSelectedCategory("all")}
                  className="hover:text-brand-danger"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedConditions.map((cond) => (
              <span
                key={cond}
                className="inline-flex items-center gap-1 bg-brand-primary-soft text-brand-primary text-xs font-semibold px-2.5 py-1 rounded-full"
              >
                <span>{cond}</span>
                <button
                  onClick={() => toggleCondition(cond)}
                  className="hover:text-brand-danger"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedCity && (
              <span className="inline-flex items-center gap-1 bg-brand-primary-soft text-brand-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                <span>Kota: {selectedCity}</span>
                <button
                  onClick={() => setSelectedCity(null)}
                  className="hover:text-brand-danger"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={resetFilters}
              className="text-xs font-bold text-brand-danger hover:underline ml-1"
            >
              Reset Semua
            </button>
          </div>
        )}
      </div>

      {/* 3. Sticky Quick Actions */}
      <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-surface-border shadow-xs flex items-center justify-between gap-3 overflow-x-auto no-scrollbar sticky top-16 sm:top-20 z-30">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setFilterSheetOpen(true)}
            className="font-bold shrink-0 gap-1.5"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-brand-primary text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>

          <div className="relative shrink-0">
            <button
              onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
              className="h-9 px-3 rounded-xl bg-surface-subtle hover:bg-outline-variant text-on-surface font-semibold text-xs flex items-center gap-1.5 transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
              <span>
                {sortOptions.find((o) => o.id === sortBy)?.label || "Paling Sesuai"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </button>

            {sortDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setSortDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-surface-border p-1.5 z-50 flex flex-col gap-0.5">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSortBy(opt.id);
                        setSortDropdownOpen(false);
                      }}
                      className={`text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between ${
                        sortBy === opt.id
                          ? "bg-brand-primary-soft text-brand-primary font-bold"
                          : "text-on-surface hover:bg-surface-subtle"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {sortBy === opt.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleCanNegoOnly}
            className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              canNegoOnly
                ? "bg-brand-accent text-white"
                : "bg-surface-subtle text-text-secondary hover:bg-outline-variant"
            }`}
          >
            <span>Bisa Nego</span>
            <Sparkles className="w-3 h-3" />
          </button>

          <button
            onClick={toggleVerifiedSellerOnly}
            className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              verifiedSellerOnly
                ? "bg-brand-secondary text-white"
                : "bg-surface-subtle text-text-secondary hover:bg-outline-variant"
            }`}
          >
            <span>KYC Verified</span>
            <ShieldCheck className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4. Results Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-72 rounded-2xl bg-surface-subtle animate-pulse border border-surface-border"
            />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="py-16 bg-white rounded-2xl border border-surface-border text-center flex flex-col items-center justify-center p-6 gap-3">
          <div className="w-16 h-16 rounded-full bg-surface-subtle flex items-center justify-center text-text-muted">
            <SlidersHorizontal className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base text-on-surface">
            Tidak ada gadget yang cocok dengan filter kamu
          </h3>
          <p className="text-xs text-text-secondary max-w-sm">
            Coba ubah kata kunci pencarian atau reset filter kondisi dan rentang harga.
          </p>
          <Button variant="primary" size="sm" onClick={resetFilters} className="mt-2">
            Reset Semua Filter
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {listings.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="md"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="font-bold"
              >
                {isLoadingMore ? "Memuat..." : "Muat Lebih Banyak"}
              </Button>
            </div>
          )}
        </div>
      )}

      <FilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
      />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-100 gap-3">
          <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-text-secondary">Memuat data pencarian...</p>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
