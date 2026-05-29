"use client";

import { Loader2, MessageSquareText, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { ChatComposer, type ChatComposerHandle } from "./chat-composer";
import { MessageBubble } from "./message-bubble";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { streamChat } from "@/lib/api/sse";
import { useChatStore } from "@/lib/stores/chat-store";
import type { Locale } from "@/i18n/routing";

export function ChatRoom() {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const composerRef = useRef<ChatComposerHandle>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const {
    conversationId,
    messages,
    isStreaming,
    appendUser,
    start,
    startAssistant,
    appendToken,
    finalizeAssistant,
    setError,
    reset,
  } = useChatStore();

  // Scroll-to-bottom on new message.
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isStreaming]);

  // Cleanup on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  const sendMessage = useCallback(
    async (text: string) => {
      appendUser(text);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        let streamingStarted = false;
        await streamChat(
          {
            message: text,
            language: locale,
            conversation_id: conversationId ?? undefined,
          },
          {
            signal: controller.signal,
            onStart: ({ conversation_id, turn_id }) =>
              start(conversation_id, turn_id),
            onToken: (token) => {
              if (!streamingStarted) {
                // Create the assistant bubble on the first token.
                startAssistant(crypto.randomUUID());
                streamingStarted = true;
              }
              appendToken(token);
            },
            onEnd: (envelope) =>
              finalizeAssistant({
                id: envelope.turn_id,
                content: envelope.final_response,
                citations: envelope.citations,
                needsEscalation: envelope.needs_escalation,
                confidence: envelope.confidence,
              }),
            onError: (message) => {
              setError(message);
              toast.error(message);
            },
          },
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        toast.error(message);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [appendUser, appendToken, conversationId, finalizeAssistant, locale, setError, start, startAssistant],
  );

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
        <p className="text-sm text-[var(--muted-foreground)]">{t("description")}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            abortRef.current?.abort();
            reset();
            composerRef.current?.focus();
          }}
          disabled={messages.length === 0}
        >
          <RotateCcw className="h-4 w-4" />
          {t("clear")}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        {messages.length === 0 ? (
          <EmptyState
            icon={<MessageSquareText />}
            title={t("title")}
            description={t("description")}
          />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isStreaming ? (
              <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("thinking")}
              </div>
            ) : null}
            <div ref={scrollAnchorRef} aria-hidden />
          </div>
        )}
      </div>

      <ChatComposer
        ref={composerRef}
        disabled={isStreaming}
        isStreaming={isStreaming}
        onSubmit={sendMessage}
        onAbort={() => abortRef.current?.abort()}
      />
    </div>
  );
}
