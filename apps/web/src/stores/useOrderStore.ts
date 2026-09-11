import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Order, OrderStatus, ProductListing, ReviewSubmission } from "../types";
import { SEED_ORDERS } from "../lib/seedData";
import { useWalletStore } from "./useWalletStore";
import { useNotificationStore } from "./useNotificationStore";

interface CreateOrderPayload {
  listing: ProductListing;
  itemPrice: number;
  shippingFee: number;
  escrowFee: number;
  totalAmount: number;
  buyerName: string;
  buyerPhone: string;
  shippingAddress: string;
  courier: string;
  paymentMethod: "BCA_VA" | "MANDIRI_VA" | "BRI_VA" | "BNI_VA" | "QRIS";
}

interface OrderStore {
  orders: Order[];
  reviews: ReviewSubmission[];

  createOrder: (payload: CreateOrderPayload) => Order;
  getOrderById: (orderId: string) => Order | undefined;
  payOrder: (orderId: string) => void;
  shipOrder: (orderId: string, trackingNumber: string, courierName?: string) => void;
  simulateDelivered: (orderId: string) => void;
  confirmOrderReceived: (orderId: string) => void;
  markAsDisputed: (orderId: string, disputeId: string) => void;
  submitReview: (orderId: string, rating: number, tags: string[], comment: string) => void;
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      orders: SEED_ORDERS,
      reviews: [],

      createOrder: (payload) => {
        const orderId = `STX-2026-${Math.floor(10000 + Math.random() * 90000)}`;
        const vaNumber = `827708${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        const newOrder: Order = {
          id: orderId,
          listing: payload.listing,
          buyerId: "user-budi",
          buyerName: payload.buyerName,
          buyerPhone: payload.buyerPhone,
          shippingAddress: payload.shippingAddress,
          itemPrice: payload.itemPrice,
          shippingFee: payload.shippingFee,
          escrowFee: payload.escrowFee,
          totalAmount: payload.totalAmount,
          paymentMethod: payload.paymentMethod,
          vaNumber,
          status: "PENDING_PAYMENT",
          paymentExpiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours
          courier: payload.courier,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          orders: [newOrder, ...state.orders],
        }));

        useNotificationStore.getState().addNotification({
          type: "ORDER",
          title: "Pesanan Dibuat 🎉",
          message: `Segera selesaikan pembayaran untuk pesanan ${payload.listing.title}`,
          link: `/payment/${orderId}/pending`,
        });

        return newOrder;
      },

      getOrderById: (orderId) => {
        return get().orders.find((o) => o.id === orderId);
      },

      payOrder: (orderId) => {
        set((state) => ({
          orders: state.orders.map((o) => {
            if (o.id === orderId) {
              return {
                ...o,
                status: "FUNDED" as OrderStatus,
              };
            }
            return o;
          }),
        }));

        const order = get().orders.find((o) => o.id === orderId);
        if (order) {
          useNotificationStore.getState().addNotification({
            type: "ESCROW",
            title: "Pembayaran Diterima & Terlindungi Escrow 🔒",
            message: `Dana Rp ${order.totalAmount.toLocaleString("id-ID")} berhasil ditahan di rekening bersama resmi. Penjual diminta segera mengirim barang.`,
            link: `/orders/${orderId}`,
          });
        }
      },

      shipOrder: (orderId, trackingNumber, courierName) => {
        set((state) => ({
          orders: state.orders.map((o) => {
            if (o.id === orderId) {
              return {
                ...o,
                status: "SHIPPED" as OrderStatus,
                trackingNumber,
                courier: courierName || o.courier,
                shippedAt: new Date().toISOString(),
              };
            }
            return o;
          }),
        }));

        useNotificationStore.getState().addNotification({
          type: "SHIPPING",
          title: "Pesanan Sedang Dikirim 🚚",
          message: `Penjual telah menginput nomor resi ${trackingNumber}. Lacak perjalanan paketmu.`,
          link: `/orders/${orderId}`,
        });
      },

      simulateDelivered: (orderId) => {
        set((state) => ({
          orders: state.orders.map((o) => {
            if (o.id === orderId) {
              return {
                ...o,
                status: "INSPECTING" as OrderStatus,
                deliveredAt: new Date().toISOString(),
                inspectionExpiresAt: new Date(Date.now() + 172800000).toISOString(), // 2x24 hours
              };
            }
            return o;
          }),
        }));

        useNotificationStore.getState().addNotification({
          type: "INSPECTION",
          title: "Paket Tiba! Masa Inspeksi 2x24 Jam Dimulai ⏱️",
          message: "Periksa kondisi fisik dan fungsi gadget sebelum mengizinkan pencairan dana ke penjual.",
          link: `/orders/${orderId}`,
        });
      },

      confirmOrderReceived: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (order) {
          // Release money to seller's wallet
          useWalletStore.getState().releaseEscrowToWallet(
            order.itemPrice,
            order.id,
            order.listing.title
          );

          set((state) => ({
            orders: state.orders.map((o) => {
              if (o.id === orderId) {
                return {
                  ...o,
                  status: "COMPLETED" as OrderStatus,
                  completedAt: new Date().toISOString(),
                };
              }
              return o;
            }),
          }));

          useNotificationStore.getState().addNotification({
            type: "COMPLETED",
            title: "Transaksi Selesai & Dana Dicairkan! 🎉",
            message: `Dana Rp ${order.itemPrice.toLocaleString("id-ID")} telah diteruskan ke saldo dompet penjual. Jangan lupa beri ulasan!`,
            link: `/orders/${orderId}`,
          });
        }
      },

      markAsDisputed: (orderId, disputeId) => {
        set((state) => ({
          orders: state.orders.map((o) => {
            if (o.id === orderId) {
              return {
                ...o,
                status: "DISPUTED" as OrderStatus,
                disputeId,
              };
            }
            return o;
          }),
        }));

        useNotificationStore.getState().addNotification({
          type: "DISPUTE",
          title: "Tiket Sengketa Dibuka 🛡️",
          message: `Kasus ${disputeId} sedang ditangani tim mediasi NgeBekasinYuk. Dana dibekukan sementara.`,
          link: `/disputes/${disputeId}`,
        });
      },

      submitReview: (orderId, rating, tags, comment) => {
        const review: ReviewSubmission = {
          orderId,
          rating,
          tags,
          comment,
          photos: [],
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          reviews: [review, ...state.reviews],
          orders: state.orders.map((o) =>
            o.id === orderId ? { ...o, reviewGiven: true } : o
          ),
        }));

        useNotificationStore.getState().addNotification({
          type: "REVIEW",
          title: "Ulasan Terkirim ⭐",
          message: "Terima kasih atas ulasanmu! Komunitas tech secondhand terbantu dengan testimoni jujur.",
        });
      },
    }),
    {
      name: "ngebekasinyuk-orders-storage",
    }
  )
);
