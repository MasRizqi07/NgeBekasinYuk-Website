import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Conversation, Offer } from "../types";
import { SEED_CONVERSATIONS } from "../lib/seedData";
import { useNotificationStore } from "./useNotificationStore";

interface ChatStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  isCounterpartTyping: boolean;

  setActiveConversationId: (id: string | null) => void;
  getConversationById: (id: string) => Conversation | undefined;
  sendMessage: (convoId: string, text: string, imageUrl?: string) => void;
  sendOffer: (convoId: string, offerPrice: number) => void;
  acceptOffer: (convoId: string, offerId: string) => void;
  rejectOffer: (convoId: string, offerId: string) => void;
  counterOffer: (convoId: string, offerId: string, counterPrice: number) => void;
  getUnreadMessagesCount: () => number;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      conversations: SEED_CONVERSATIONS,
      activeConversationId: null,
      isCounterpartTyping: false,

      setActiveConversationId: (id) => set({ activeConversationId: id }),

      getConversationById: (id) => {
        return get().conversations.find((c) => c.id === id);
      },

      sendMessage: (convoId, text, imageUrl) => {
        const timeNow = new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const userMsg = {
          id: `msg-${Date.now()}`,
          senderId: "user-budi",
          senderName: "Budi Pratama",
          text,
          imageUrl,
          timestamp: timeNow,
          isRead: true,
        };

        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id === convoId) {
              return {
                ...c,
                lastMessage: text,
                lastTimestamp: new Date().toISOString(),
                messages: [...c.messages, userMsg],
              };
            }
            return c;
          }),
        }));

        // Simulate seller auto-reply after 1.5 seconds
        set({ isCounterpartTyping: true });
        setTimeout(() => {
          const convo = get().conversations.find((c) => c.id === convoId);
          if (!convo) return;

          const sellerReplies = [
            "Siap kak! Unit masih sangat mulus dan selalu tersimpan di pouch.",
            "Boleh kak, packing selalu kami lapisi bubble wrap 5 lapis dan kardus dobel.",
            "Untuk pengiriman bisa pakai J&T atau SiCepat hari ini langsung kami drop ke kurir.",
            "Jika sudah oke silakan checkout via Rekber ya kak, dana aman di escrow.",
          ];
          const randomReply =
            sellerReplies[Math.floor(Math.random() * sellerReplies.length)];

          const sellerMsg = {
            id: `msg-seller-${Date.now()}`,
            senderId: convo.counterpart.id,
            senderName: convo.counterpart.name,
            text: randomReply,
            timestamp: new Date().toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isRead: false,
          };

          set((state) => ({
            isCounterpartTyping: false,
            conversations: state.conversations.map((c) => {
              if (c.id === convoId) {
                return {
                  ...c,
                  lastMessage: randomReply,
                  lastTimestamp: new Date().toISOString(),
                  unreadCount: c.unreadCount + 1,
                  messages: [...c.messages, sellerMsg],
                };
              }
              return c;
            }),
          }));

          useNotificationStore.getState().addNotification({
            type: "OFFER",
            title: `Pesan baru dari ${convo.counterpart.name}`,
            message: randomReply,
            link: `/chat/${convoId}`,
          });
        }, 1600);
      },

      sendOffer: (convoId, offerPrice) => {
        const convo = get().conversations.find((c) => c.id === convoId);
        if (!convo) return;

        const originalPrice = convo.listing.price;
        const discountPercent = Math.round(
          ((originalPrice - offerPrice) / originalPrice) * 100
        );

        const newOffer: Offer = {
          id: `offer-${Date.now()}`,
          listingId: convo.listing.id,
          buyerId: "user-budi",
          sellerId: convo.counterpart.id,
          originalPrice,
          offerPrice,
          discountPercent,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        };

        const timeNow = new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const offerMsg = {
          id: `msg-offer-${Date.now()}`,
          senderId: "user-budi",
          senderName: "Budi Pratama",
          text: `Mengajukan penawaran harga: Rp ${offerPrice.toLocaleString("id-ID")}`,
          timestamp: timeNow,
          isRead: true,
          offer: newOffer,
        };

        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id === convoId) {
              return {
                ...c,
                lastMessage: `Penawaran: Rp ${offerPrice.toLocaleString("id-ID")}`,
                lastTimestamp: new Date().toISOString(),
                messages: [...c.messages, offerMsg],
              };
            }
            return c;
          }),
        }));
      },

      acceptOffer: (convoId, offerId) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id === convoId) {
              return {
                ...c,
                messages: c.messages.map((m) => {
                  if (m.offer && m.offer.id === offerId) {
                    return {
                      ...m,
                      offer: {
                        ...m.offer,
                        status: "ACCEPTED",
                        checkoutWindowExpiresAt: new Date(
                          Date.now() + 7200000
                        ).toISOString(), // 2 hours
                      },
                    };
                  }
                  return m;
                }),
              };
            }
            return c;
          }),
        }));

        useNotificationStore.getState().addNotification({
          type: "OFFER",
          title: "Tawaran Disetujui! 🤝",
          message:
            "Harga kesepakatan terkunci 2 jam untuk checkout via Rekber resmi.",
          link: `/chat/${convoId}`,
        });
      },

      rejectOffer: (convoId, offerId) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id === convoId) {
              return {
                ...c,
                messages: c.messages.map((m) => {
                  if (m.offer && m.offer.id === offerId) {
                    return {
                      ...m,
                      offer: { ...m.offer, status: "REJECTED" },
                    };
                  }
                  return m;
                }),
              };
            }
            return c;
          }),
        }));
      },

      counterOffer: (convoId, offerId, counterPrice) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id === convoId) {
              return {
                ...c,
                messages: c.messages.map((m) => {
                  if (m.offer && m.offer.id === offerId) {
                    return {
                      ...m,
                      offer: {
                        ...m.offer,
                        status: "COUNTERED",
                        offerPrice: counterPrice,
                      },
                    };
                  }
                  return m;
                }),
              };
            }
            return c;
          }),
        }));
      },

      getUnreadMessagesCount: () => {
        return get().conversations.reduce((sum, c) => sum + c.unreadCount, 0);
      },
    }),
    {
      name: "ngebekasinyuk-chat-storage",
    }
  )
);
