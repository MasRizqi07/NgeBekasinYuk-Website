import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserAddress, UserProfile } from "../types";
import { useChatStore } from "./useChatStore";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface ServerSessionUserPayload {
  id: string;
  email: string;
  name: string;
  role?: string;
  isVerified?: boolean;
  avatar?: string | null;
  phone?: string | null;
  city?: string | null;
  bio?: string | null;
  storeName?: string | null;
  rating?: number | null;
  totalSales?: number | null;
  joinedDate?: string | null;
}

const DEFAULT_CHECKOUT_ADDRESSES: UserAddress[] = [
  {
    id: "addr-default",
    label: "Alamat Utama",
    recipientName: "Pembeli NgeBekasinYuk",
    phone: "0812-0000-0000",
    addressLine: "Jl. Sudirman Kav 28, Karet Tengsin, Tanah Abang",
    city: "Jakarta Pusat",
    postalCode: "10220",
    isDefault: true,
  },
];

function buildGuestProfile(
  addresses: UserAddress[] = DEFAULT_CHECKOUT_ADDRESSES,
  favorites: string[] = []
): UserProfile {
  return {
    id: "",
    name: "",
    email: "",
    phone: "",
    avatar: "",
    isKYCVerified: false,
    trustScore: 0,
    joinedDate: "",
    addresses,
    favorites,
    role: undefined,
    city: undefined,
    bio: undefined,
    totalSales: 0,
  };
}

interface UserStore {
  user: UserProfile;
  isLoggedIn: boolean;
  authStatus: AuthStatus;

  syncSession: () => Promise<void>;
  setAuthenticatedUser: (serverUser: ServerSessionUserPayload) => void;
  updateProfile: (partial: Partial<UserProfile>) => void;
  addAddress: (addr: Omit<UserAddress, "id">) => void;
  setDefaultAddress: (id: string) => void;
  toggleFavorite: (listingId: string) => void;
  submitKYC: (nik: string, ktpPhoto: string, selfiePhoto: string) => void;
  login: (email?: string, serverUser?: ServerSessionUserPayload) => void;
  logout: () => Promise<void>;
}

/**
 * Auth identity (`id`, `name`, `email`, `role`, `isLoggedIn`) is strictly derived
 * from server `/api/auth/session` and is NEVER persisted to localStorage.
 * Only non-sensitive UI conveniences (`addresses`, `favorites`) are persisted locally.
 */
export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: buildGuestProfile(),
      isLoggedIn: false,
      authStatus: "loading",

      setAuthenticatedUser: (serverUser) =>
        set((state) => {
          const isVerified = Boolean(serverUser.isVerified);
          const updatedAddresses =
            state.user.addresses.length > 0
              ? state.user.addresses.map((a, idx) =>
                  idx === 0 && a.id === "addr-default"
                    ? {
                        ...a,
                        recipientName: serverUser.name || a.recipientName,
                        phone: serverUser.phone || a.phone,
                      }
                    : a
                )
              : DEFAULT_CHECKOUT_ADDRESSES;

          return {
            isLoggedIn: true,
            authStatus: "authenticated",
            user: {
              ...state.user,
              id: serverUser.id,
              name: serverUser.name,
              email: serverUser.email,
              phone: serverUser.phone || state.user.phone || "",
              avatar: serverUser.avatar ?? "",
              role: serverUser.role,
              isKYCVerified: isVerified,
              trustScore: isVerified ? 95 : 50,
              joinedDate: serverUser.joinedDate || state.user.joinedDate || "Baru bergabung",
              city: serverUser.city || state.user.city || "Indonesia",
              bio: serverUser.bio || state.user.bio || "Pengguna terautentikasi NgeBekasinYuk Escrow.",
              totalSales: serverUser.totalSales ?? state.user.totalSales ?? 0,
              addresses: updatedAddresses,
            },
          };
        }),

      syncSession: async () => {
        try {
          const res = await fetch("/api/auth/session", { cache: "no-store" });
          const json = (await res.json().catch(() => null)) as {
            authenticated?: boolean;
            user?: ServerSessionUserPayload | null;
          } | null;

          if (res.ok && json?.authenticated && json.user) {
            get().setAuthenticatedUser(json.user);
            return;
          }
        } catch {
          // Network issue falls back safely to unauthenticated shell without spoofing a user
        }

        set((state) => ({
          isLoggedIn: false,
          authStatus: "unauthenticated",
          user: buildGuestProfile(state.user.addresses, state.user.favorites),
        }));
      },

      updateProfile: (partial) =>
        set((state) => ({
          user: { ...state.user, ...partial },
        })),

      addAddress: (addrData) => {
        const id = `addr-${Date.now()}`;
        const newAddr: UserAddress = {
          ...addrData,
          id,
        };

        set((state) => ({
          user: {
            ...state.user,
            addresses: addrData.isDefault
              ? [
                  ...state.user.addresses.map((a) => ({ ...a, isDefault: false })),
                  newAddr,
                ]
              : [...state.user.addresses, newAddr],
          },
        }));
      },

      setDefaultAddress: (id) =>
        set((state) => ({
          user: {
            ...state.user,
            addresses: state.user.addresses.map((a) => ({
              ...a,
              isDefault: a.id === id,
            })),
          },
        })),

      toggleFavorite: (listingId) =>
        set((state) => {
          const exists = state.user.favorites.includes(listingId);
          return {
            user: {
              ...state.user,
              favorites: exists
                ? state.user.favorites.filter((f) => f !== listingId)
                : [...state.user.favorites, listingId],
            },
          };
        }),

      submitKYC: (nik, ktpPhoto, selfiePhoto) =>
        set((state) => ({
          user: {
            ...state.user,
            isKYCVerified: true,
            trustScore: Math.min(100, (state.user.trustScore || 50) + 10),
            kycData: {
              nik,
              ktpPhotoUrl: ktpPhoto,
              selfieUrl: selfiePhoto,
              verifiedAt: new Date().toISOString(),
            },
          },
        })),

      login: (email, serverUser) => {
        if (serverUser) {
          get().setAuthenticatedUser(serverUser);
          return;
        }
        set((state) => ({
          isLoggedIn: true,
          authStatus: "authenticated",
          user: {
            ...state.user,
            email: email || state.user.email,
          },
        }));
      },

      logout: async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch {
          // Clear client identity state even if network request fails
        }
        useChatStore.getState().resetChatState();
        set((state) => ({
          isLoggedIn: false,
          authStatus: "unauthenticated",
          user: buildGuestProfile(state.user.addresses, state.user.favorites),
        }));
      },
    }),
    {
      name: "ngebekasinyuk-user-storage",
      partialize: partializeUserState,
      merge: mergeUserState,
    }
  )
);

/**
 * Persists only non-authoritative UI preferences (saved addresses and favorites); identity and auth status always come from the server.
 */
export function partializeUserState(state: UserStore): {
  addresses: UserAddress[];
  favorites: string[];
} {
  return {
    addresses: state.user.addresses,
    favorites: state.user.favorites,
  };
}

/**
 * Rehydrates persisted addresses/favorites while forcing auth state into a neutral guest profile until `/api/auth/session` responds.
 */
export function mergeUserState(
  persistedState: unknown,
  currentState: UserStore
): UserStore {
  const raw = (persistedState || {}) as {
    addresses?: UserAddress[];
    favorites?: string[];
    user?: Partial<UserProfile>;
  };
  const persistedAddresses = Array.isArray(raw.addresses)
    ? raw.addresses
    : Array.isArray(raw.user?.addresses)
    ? raw.user.addresses
    : currentState.user.addresses;
  const persistedFavorites = Array.isArray(raw.favorites)
    ? raw.favorites
    : Array.isArray(raw.user?.favorites)
    ? raw.user.favorites
    : currentState.user.favorites;

  return {
    ...currentState,
    isLoggedIn: false,
    authStatus: "loading",
    user: buildGuestProfile(
      persistedAddresses.length > 0
        ? persistedAddresses
        : DEFAULT_CHECKOUT_ADDRESSES,
      persistedFavorites
    ),
  };
}
