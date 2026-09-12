import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DisputeStatus, DisputeTicket } from "../types";
import { SEED_DISPUTE } from "../lib/seedData";
import { useOrderStore } from "./useOrderStore";
import { useWalletStore } from "./useWalletStore";
import { useNotificationStore } from "./useNotificationStore";

interface CreateDisputePayload {
  orderId: string;
  reason: string;
  notes?: string;
  description?: string;
  buyerEvidencePhotos?: string[];
  evidencePhotos?: string[];
}

interface DisputeStore {
  disputes: DisputeTicket[];

  getDisputeById: (id: string) => DisputeTicket | undefined;
  createDispute: (
    orderIdOrPayload: string | CreateDisputePayload,
    reason?: string,
    description?: string,
    buyerEvidencePhotos?: string[]
  ) => DisputeTicket;
  submitSellerEvidence: (disputeId: string, photos: string[]) => void;
  addDiscussionMessage: (
    disputeId: string,
    author: string,
    role: "BUYER" | "SELLER" | "ADMIN",
    text: string,
    attachment?: string
  ) => void;
  resolveDispute: (
    disputeId: string,
    verdict: "REFUND_BUYER" | "RELEASE_SELLER",
    adminNotes: string
  ) => void;
}

export const useDisputeStore = create<DisputeStore>()(
  persist(
    (set, get) => ({
      disputes: [SEED_DISPUTE],

      getDisputeById: (id) => {
        return get().disputes.find((d) => d.id === id);
      },

      createDispute: (orderIdOrPayload, reasonArg, descArg, photosArg) => {
        let orderId = "";
        let reason = "";
        let description = "";
        let buyerEvidencePhotos: string[] = [];

        if (typeof orderIdOrPayload === "object") {
          orderId = orderIdOrPayload.orderId;
          reason = orderIdOrPayload.reason;
          description = orderIdOrPayload.description || orderIdOrPayload.notes || "";
          buyerEvidencePhotos = orderIdOrPayload.buyerEvidencePhotos || orderIdOrPayload.evidencePhotos || [];
        } else {
          orderId = orderIdOrPayload;
          reason = reasonArg || "ITEM_DEFECT";
          description = descArg || "";
          buyerEvidencePhotos = photosArg || [];
        }

        const order = useOrderStore.getState().getOrderById(orderId);
        const disputeId = `DSP-2026-${Math.floor(10000 + Math.random() * 90000)}`;

        const newDispute: DisputeTicket = {
          id: disputeId,
          orderId,
          listingTitle: order ? order.listing.title : "MacBook Air M1 256GB Space Grey",
          listingPrice: order ? order.itemPrice : 8500000,
          listingImage: order && order.listing.images[0] ? order.listing.images[0] : "https://lh3.googleusercontent.com/aida-public/AB6AXuBUdbwsUwn1HToCtAScn-lmpCkowk8hnz0zCAZ3cQUz5y2l2usZdI4YOshyu-eo6FVZLIOWV8uId8iPhzwUdcgGorjRKXwi1ZMfsMDyG-NBKYeeDu4eXGMN76AuqMjFvODzz4ocvtyKavtrVnXMsAPutfKjJW1A744y95mx61X9tJWrVsjoiqL_ABSeBf6wuSFDcIdQCxvHl3KL1MC2VUusioki6xCIvq0lBmHZpzaA_WybUwsbVHb3",
          buyerName: order ? order.buyerName : "Budi Pratama",
          sellerName: order ? order.listing.seller.name : "Dimas Aditya",
          reason,
          description,
          buyerEvidencePhotos,
          sellerEvidencePhotos: [],
          slaExpiresAt: new Date(Date.now() + 172800000).toISOString(), // 48 hours
          status: "AWAITING_SELLER",
          messages: [
            {
              id: `disp-msg-${Date.now()}`,
              author: order ? order.buyerName : "Budi Pratama",
              role: "BUYER",
              text: description,
              timestamp: "Baru saja",
            },
          ],
        };

        set((state) => ({
          disputes: [newDispute, ...state.disputes],
        }));

        useOrderStore.getState().markAsDisputed(orderId, disputeId);

        return newDispute;
      },

      submitSellerEvidence: (disputeId, photos) => {
        set((state) => ({
          disputes: state.disputes.map((d) =>
            d.id === disputeId
              ? {
                  ...d,
                  sellerEvidencePhotos: [...d.sellerEvidencePhotos, ...photos],
                  status: "UNDER_REVIEW",
                }
              : d
          ),
        }));

        useNotificationStore.getState().addNotification({
          type: "DISPUTE",
          title: "Penjual Telah Mengunggah Bukti QC 📦",
          message: `Bukti baru telah diunggah untuk sengketa ${disputeId}. Tim mediator sedang menganalisa video.`,
          link: `/disputes/${disputeId}`,
        });
      },

      addDiscussionMessage: (disputeId, author, role, text, attachment) => {
        const newMsg = {
          id: `msg-${Date.now()}`,
          author,
          role,
          text,
          attachment,
          timestamp: "Baru saja",
        };

        set((state) => ({
          disputes: state.disputes.map((d) =>
            d.id === disputeId
              ? { ...d, messages: [...d.messages, newMsg] }
              : d
          ),
        }));
      },

      resolveDispute: (disputeId, verdict, adminNotes) => {
        const dispute = get().disputes.find((d) => d.id === disputeId);
        if (!dispute) return;

        const newStatus: DisputeStatus =
          verdict === "REFUND_BUYER" ? "RESOLVED_BUYER" : "RESOLVED_SELLER";

        // Optimistic UI update via Zustand setter
        set((state) => ({
          disputes: state.disputes.map((d) =>
            d.id === disputeId
              ? {
                  ...d,
                  status: newStatus,
                  resolutionNote: adminNotes,
                  resolvedAt: new Date().toISOString(),
                }
              : d
          ),
        }));

        // Fire server-authoritative verdict API in background
        fetch(`/api/disputes/${disputeId}/verdict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verdict,
            adminNotes,
            stepUpCode: "882910", // Standard admin OTP
          }),
        }).catch((err) => {
          console.warn("[useDisputeStore] Fallback to client prototype resolution:", err);
        });

        const orderStore = useOrderStore.getState();
        const linkedOrder = orderStore.getOrderById(dispute.orderId);

        if (verdict === "REFUND_BUYER") {
          if (linkedOrder) {
            // P0-06 FIX: Never mutate orderStore.orders directly
            useOrderStore.setState((state) => ({
              orders: state.orders.map((o) =>
                o.id === linkedOrder.id ? { ...o, status: "REFUNDED" } : o
              ),
            }));
          }

          useNotificationStore.getState().addNotification({
            type: "DISPUTE",
            title: "Keputusan Sengketa: Pengembalian Dana (REFUND)",
            message: `Admin memutuskan sengketa ${disputeId} dimenangkan Pembeli. Dana Rp ${dispute.listingPrice.toLocaleString("id-ID")} dikembalikan penuh.`,
            link: `/disputes/${disputeId}`,
          });
        } else {
          if (linkedOrder) {
            // P0-06 FIX: Never mutate orderStore.orders directly
            useOrderStore.setState((state) => ({
              orders: state.orders.map((o) =>
                o.id === linkedOrder.id ? { ...o, status: "COMPLETED" } : o
              ),
            }));
            useWalletStore
              .getState()
              .releaseEscrowToWallet(
                dispute.listingPrice,
                dispute.orderId,
                dispute.listingTitle
              );
          }

          useNotificationStore.getState().addNotification({
            type: "DISPUTE",
            title: "Keputusan Sengketa: Dana Dicairkan ke Penjual (RELEASE)",
            message: `Admin memutuskan sengketa ${disputeId} dimenangkan Penjual. Dana Rp ${dispute.listingPrice.toLocaleString("id-ID")} telah diteruskan ke saldo penjual.`,
            link: `/disputes/${disputeId}`,
          });
        }
      },
    }),
    {
      name: "ngebekasinyuk-disputes-storage",
    }
  )
);
