import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ProductListing } from "../types";

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

interface CartStore {
  items: { listing: ProductListing; quantity: number; negotiatedPrice?: number }[];
  selectedCourier: CourierService;
  selectedAddressId: string;

  addItem: (listing: ProductListing, negotiatedPrice?: number) => void;
  addToCart: (listing: ProductListing, negotiatedPrice?: number) => void;
  removeItem: (listingId: string) => void;
  clearCart: () => void;
  setSelectedCourier: (courier: CourierService) => void;
  setSelectedAddressId: (addressId: string) => void;

  getSubtotal: () => number;
  getEscrowFee: () => number;
  getTotalAmount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      selectedCourier: AVAILABLE_COURIERS[0],
      selectedAddressId: "addr-1",

      addItem: (listing, negotiatedPrice) => {
        set((state) => {
          const existing = state.items.find((i) => i.listing.id === listing.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.listing.id === listing.id
                  ? { ...i, negotiatedPrice: negotiatedPrice || i.negotiatedPrice }
                  : i
              ),
            };
          }
          return {
            items: [...state.items, { listing, quantity: 1, negotiatedPrice }],
          };
        });
      },

      addToCart: (listing, negotiatedPrice) => {
        get().addItem(listing, negotiatedPrice);
      },

      removeItem: (listingId) =>
        set((state) => ({
          items: state.items.filter((i) => i.listing.id !== listingId),
        })),

      clearCart: () => set({ items: [] }),

      setSelectedCourier: (courier) => set({ selectedCourier: courier }),
      setSelectedAddressId: (addressId) => set({ selectedAddressId: addressId }),

      getSubtotal: () => {
        const { items } = get();
        return items.reduce((acc, item) => {
          const price = item.negotiatedPrice || item.listing.price;
          return acc + price * item.quantity;
        }, 0);
      },

      getEscrowFee: () => {
        // Promo Launching: 0 IDR (normally 2.5%)
        return 0;
      },

      getTotalAmount: () => {
        const { getSubtotal, getEscrowFee, selectedCourier } = get();
        return getSubtotal() + selectedCourier.price + getEscrowFee();
      },
    }),
    {
      name: "ngebekasinyuk-cart-storage",
    }
  )
);
