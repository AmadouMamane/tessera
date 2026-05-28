/**
 * Client-side conversation state.
 *
 * We keep the conversation in a Zustand store rather than React component
 * state so that the SSE callbacks (which live outside the render tree)
 * can update messages without prop-drilling and without re-rendering the
 * composer on every token.
 *
 * The store is intentionally kept lean — no persistence yet; reloading the
 * page resets the conversation. Persistence will be added when a
 * conversations API lands on the backend.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import type { ChatCitation } from "@/lib/api/schemas";

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  citations?: ChatCitation[];
  needsEscalation?: boolean;
  confidence?: number | null;
}

interface ChatState {
  conversationId: string | null;
  turnId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  lastError: string | null;
  start: (conversationId: string, turnId: string) => void;
  appendUser: (content: string) => ChatMessage;
  finalizeAssistant: (message: Omit<ChatMessage, "createdAt" | "role">) => void;
  setError: (message: string) => void;
  setStreaming: (streaming: boolean) => void;
  reset: () => void;
}

function id(): string {
  return globalThis.crypto?.randomUUID() ?? Math.random().toString(36).slice(2);
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set) => ({
      conversationId: null,
      turnId: null,
      messages: [],
      isStreaming: false,
      lastError: null,

      start: (conversationId, turnId) =>
        set({ conversationId, turnId, isStreaming: true, lastError: null }),

      appendUser: (content) => {
        const message: ChatMessage = {
          id: id(),
          role: "user",
          content,
          createdAt: Date.now(),
        };
        set((state) => ({ messages: [...state.messages, message] }));
        return message;
      },

      finalizeAssistant: (payload) =>
        set((state) => ({
          messages: [
            ...state.messages,
            { ...payload, role: "assistant", createdAt: Date.now() },
          ],
          isStreaming: false,
        })),

      setError: (lastError) =>
        set({ lastError, isStreaming: false }),

      setStreaming: (isStreaming) => set({ isStreaming }),

      reset: () =>
        set({
          conversationId: null,
          turnId: null,
          messages: [],
          isStreaming: false,
          lastError: null,
        }),
    }),
    { name: "tessera-chat" },
  ),
);
