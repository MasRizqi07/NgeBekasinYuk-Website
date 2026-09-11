import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ProductListing, TechCondition } from "../types";
import { SEED_LISTINGS } from "../lib/seedData";

interface ListingStore {
  listings: ProductListing[];
  searchQuery: string;
  selectedCategory: string;
  selectedConditions: TechCondition[];
  minPrice: number | null;
  maxPrice: number | null;
  selectedCity: string | null;
  verifiedSellerOnly: boolean;
  canNegoOnly: boolean;
  sortBy: "relevant" | "price_low" | "price_high" | "newest";

  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  toggleCondition: (condition: TechCondition) => void;
  setPriceRange: (min: number | null, max: number | null) => void;
  setSelectedCity: (city: string | null) => void;
  toggleVerifiedSellerOnly: () => void;
  toggleCanNegoOnly: () => void;
  setSortBy: (sort: "relevant" | "price_low" | "price_high" | "newest") => void;
  resetFilters: () => void;

  addListing: (listing: Omit<ProductListing, "id" | "slug" | "createdAt" | "viewsCount" | "favoritesCount">) => ProductListing;
  updateListing: (id: string, partial: Partial<ProductListing>) => void;
  deleteListing: (id: string) => void;
  toggleFavorite: (id: string) => void;
  getFilteredListings: () => ProductListing[];
}

export const useListingStore = create<ListingStore>()(
  persist(
    (set, get) => ({
      listings: SEED_LISTINGS,
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

      addListing: (newListingData) => {
        const id = `prod-${Date.now()}`;
        const slug = `${newListingData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${id.slice(-4)}`;
        const newListing: ProductListing = {
          ...newListingData,
          id,
          slug,
          createdAt: new Date().toISOString(),
          viewsCount: 1,
          favoritesCount: 0,
        };
        set((state) => ({
          listings: [newListing, ...state.listings],
        }));
        return newListing;
      },

      updateListing: (id, partial) =>
        set((state) => ({
          listings: state.listings.map((item) =>
            item.id === id ? { ...item, ...partial } : item
          ),
        })),

      deleteListing: (id) =>
        set((state) => ({
          listings: state.listings.filter((item) => item.id !== id),
        })),

      toggleFavorite: (id) =>
        set((state) => ({
          listings: state.listings.map((item) =>
            item.id === id
              ? {
                  ...item,
                  favoritesCount: item.favoritesCount + 1,
                }
              : item
          ),
        })),

      getFilteredListings: () => {
        const {
          listings,
          searchQuery,
          selectedCategory,
          selectedConditions,
          minPrice,
          maxPrice,
          selectedCity,
          verifiedSellerOnly,
          canNegoOnly,
          sortBy,
        } = get();

        return listings
          .filter((item) => {
            // Text Search
            if (searchQuery.trim()) {
              const query = searchQuery.toLowerCase();
              const matchTitle = item.title.toLowerCase().includes(query);
              const matchBrand = item.brand.toLowerCase().includes(query);
              const matchDesc = item.description.toLowerCase().includes(query);
              const matchCity = item.city.toLowerCase().includes(query);
              if (!matchTitle && !matchBrand && !matchDesc && !matchCity) return false;
            }

            // Category filter
            if (selectedCategory && selectedCategory !== "all") {
              if (item.category !== selectedCategory) return false;
            }

            // Condition filter
            if (selectedConditions.length > 0) {
              if (!selectedConditions.includes(item.condition)) return false;
            }

            // Price filter
            if (minPrice !== null && item.price < minPrice) return false;
            if (maxPrice !== null && item.price > maxPrice) return false;

            // City filter
            if (selectedCity && !item.city.toLowerCase().includes(selectedCity.toLowerCase())) {
              return false;
            }

            // Verified Seller
            if (verifiedSellerOnly && !item.seller.verifiedKYC) return false;

            // Nego
            if (canNegoOnly && !item.canNego) return false;

            return true;
          })
          .sort((a, b) => {
            if (sortBy === "price_low") return a.price - b.price;
            if (sortBy === "price_high") return b.price - a.price;
            if (sortBy === "newest")
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            // Default relevant / promoted first
            return (b.isPromoted ? 1 : 0) - (a.isPromoted ? 1 : 0);
          });
      },
    }),
    {
      name: "ngebekasinyuk-listings-storage",
    }
  )
);
