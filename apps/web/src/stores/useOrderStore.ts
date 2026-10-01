import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ReviewSubmission } from "../types";
import { useNotificationStore } from "./useNotificationStore";

interface OrderStore {
  reviews: ReviewSubmission[];
  submitReview: (orderId: string, rating: number, tags: string[], comment: string) => void;
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set) => ({
      reviews: [],

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
