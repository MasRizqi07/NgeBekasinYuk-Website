import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AppNotification {
  id: string;
  type: "ORDER" | "ESCROW" | "SHIPPING" | "INSPECTION" | "COMPLETED" | "DISPUTE" | "OFFER" | "REVIEW" | "PROMO";
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  link?: string;
}

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "notif-1",
    type: "INSPECTION",
    title: "Masa Uji Mandiri Berlangsung ⏱️",
    message: "iPad Air 5 64GB telah tiba. Silakan cek fungsi dan kelengkapan unit sebelum konfirmasi.",
    timestamp: "10 menit lalu",
    isRead: false,
    link: "/orders/STX-2026-88421",
  },
  {
    id: "notif-2",
    type: "OFFER",
    title: "Tawaran Disetujui Penjual! 🎉",
    message: "Dimas Aditya menerima tawaran Rp 6.900.000 untuk iPad Air 5. Segera checkout sebelum kedaluwarsa.",
    timestamp: "1 jam lalu",
    isRead: false,
    link: "/chat/convo-dimas-ipad",
  },
  {
    id: "notif-3",
    type: "ESCROW",
    title: "Dana Rekber Aman Terkunci 🔐",
    message: "Pembayaran STX-2026-0932 telah diverifikasi. Dana Anda aman berada di kustodian resmi.",
    timestamp: "5 jam lalu",
    isRead: true,
    link: "/orders/STX-2026-0932",
  },
  {
    id: "notif-4",
    type: "COMPLETED",
    title: "Dana Dicairkan ke Penjual ✅",
    message: "Pesanan AirPods Pro Gen 2 telah selesai dikonfirmasi. Dana sukses diteruskan.",
    timestamp: "Kemarin",
    isRead: true,
    link: "/wallet",
  },
];

interface NotificationStore {
  notifications: AppNotification[];
  addNotification: (notif: Omit<AppNotification, "id" | "timestamp" | "isRead">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: INITIAL_NOTIFICATIONS,

      addNotification: (notif) => {
        const newEntry: AppNotification = {
          ...notif,
          id: `notif-${Date.now()}`,
          timestamp: "Baru saja",
          isRead: false,
        };
        set((state) => ({
          notifications: [newEntry, ...state.notifications],
        }));
      },

      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        })),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        })),

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.isRead).length;
      },
    }),
    {
      name: "ngebekasinyuk-notifications-storage",
    }
  )
);
