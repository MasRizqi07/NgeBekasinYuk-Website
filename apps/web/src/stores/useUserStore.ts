import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserAddress, UserProfile } from "../types";
import { SEED_USER } from "../lib/seedData";
import { useNotificationStore } from "./useNotificationStore";

interface UserStore {
  user: UserProfile;
  isLoggedIn: boolean;

  updateProfile: (partial: Partial<UserProfile>) => void;
  addAddress: (addr: Omit<UserAddress, "id">) => void;
  setDefaultAddress: (id: string) => void;
  toggleFavorite: (listingId: string) => void;
  submitKYC: (nik: string, ktpPhoto: string, selfiePhoto: string) => void;
  login: (email?: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: SEED_USER,
      isLoggedIn: true,

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
            addresses: [...state.user.addresses, newAddr],
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

      submitKYC: (nik, ktpPhoto, selfiePhoto) => {
        set((state) => ({
          user: {
            ...state.user,
            isKYCVerified: true,
            trustScore: Math.min(100, state.user.trustScore + 10),
            kycData: {
              nik,
              ktpPhotoUrl: ktpPhoto,
              selfieUrl: selfiePhoto,
              verifiedAt: new Date().toISOString(),
            },
          },
        }));

        useNotificationStore.getState().addNotification({
          type: "COMPLETED",
          title: "Verifikasi e-KYC Berhasil! ✅",
          message:
            "Selamat! Akun kamu kini berstatus Terverifikasi dengan TrustBadge hijau. Limit transaksi & jualan dibuka penuh.",
          link: "/profile",
        });
      },

      login: (email) =>
        set((state) => ({
          isLoggedIn: true,
          user: {
            ...state.user,
            email: email || state.user.email,
          },
        })),

      logout: () => set({ isLoggedIn: false }),
    }),
    {
      name: "ngebekasinyuk-user-storage",
    }
  )
);
