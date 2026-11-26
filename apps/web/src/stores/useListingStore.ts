import { create } from "zustand";
import type { TechCondition } from "../types";

export type ListingSortUi = "relevant" | "price_low" | "price_high" | "newest";

interface ListingFilterStore {
  searchQuery: string;
  selectedCategory: string;
  selectedConditions: TechCondition[];
  minPrice: number | null;
  maxPrice: number | null;
  selectedCity: string | null;
  verifiedSellerOnly: boolean;
  canNegoOnly: boolean;
  sortBy: ListingSortUi;

  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  toggleCondition: (condition: TechCondition) => void;
  setPriceRange: (min: number | null, max: number | null) => void;
  setSelectedCity: (city: string | null) => void;
  toggleVerifiedSellerOnly: () => void;
  toggleCanNegoOnly: () => void;
  setSortBy: (sort: ListingSortUi) => void;
  resetFilters: () => void;
}

// Ephemeral UI filter state only. Product listings always come from PostgreSQL via server APIs.
export const useListingStore = create<ListingFilterStore>()((set) => ({
  searchQuery: "",
  selectedCategory: "all",
  selectedConditions: [],
  minPrice: null,
  maxPrice: null,
  selectedCity: null,
  verifiedSellerOnly: false,
  canNegoOnly: false,
  sortBy: "relevant",

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  toggleCondition: (condition) =>
    set((state) => {
      const exists = state.selectedConditions.includes(condition);
      return {
        selectedConditions: exists
          ? state.selectedConditions.filter((c) => c !== condition)
          : [...state.selectedConditions, condition],
      };
    }),
  setPriceRange: (min, max) => set({ minPrice: min, maxPrice: max }),
  setSelectedCity: (city) => set({ selectedCity: city }),
  toggleVerifiedSellerOnly: () =>
    set((state) => ({ verifiedSellerOnly: !state.verifiedSellerOnly })),
  toggleCanNegoOnly: () =>
    set((state) => ({ canNegoOnly: !state.canNegoOnly })),
  setSortBy: (sort) => set({ sortBy: sort }),
  resetFilters: () =>
    set({
      searchQuery: "",
      selectedCategory: "all",
      selectedConditions: [],
      minPrice: null,
      maxPrice: null,
      selectedCity: null,
      verifiedSellerOnly: false,
      canNegoOnly: false,
      sortBy: "relevant",
    }),
}));
