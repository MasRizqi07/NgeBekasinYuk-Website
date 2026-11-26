import { create } from "zustand";
import type { Conversation } from "@/types";

interface ChatStore {
  conversations: Conversation[];
  unreadTotal: number;
  isLoading: boolean;
  syncInbox: () => Promise<void>;
  setUnreadTotal: (count: number) => void;
  resetChatState: () => void;
  getUnreadMessagesCount: () => number;
}

/**
 * Volatile client cache for server-authoritative conversations and unread count.
 * Never persists chat messages, offers, or hardcoded seed identities to localStorage.
 */
export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  unreadTotal: 0,
  isLoading: false,

  syncInbox: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/conversations?limit=30", {
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 401) {
          set({ conversations: [], unreadTotal: 0, isLoading: false });
          return;
        }
        set({ isLoading: false });
        return;
      }

      const json = (await res.json()) as {
        data?: Conversation[];
        unreadTotal?: number;
      };
      const conversations = Array.isArray(json.data) ? json.data : [];
      const unreadTotal =
        typeof json.unreadTotal === "number"
          ? json.unreadTotal
          : conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

      set({ conversations, unreadTotal, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setUnreadTotal: (count) => {
    set({ unreadTotal: Math.max(0, count) });
  },

  resetChatState: () => {
    set({ conversations: [], unreadTotal: 0, isLoading: false });
  },

  getUnreadMessagesCount: () => {
    return get().unreadTotal;
  },
}));
