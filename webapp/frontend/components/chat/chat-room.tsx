"use client";

import { ArrowDown, RotateCcw, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ChatComposer, type ChatComposerHandle } from "./chat-composer";
import { MessageBubble } from "./message-bubble";
import { TypingDots } from "./typing-dots";
import { Button } from "@/components/ui/button";
import { streamChat } from "@/lib/api/sse";
import { useChatStore } from "@/lib/stores/chat-store";
import type { Locale } from "@/i18n/routing";

const SUGGESTED_PROMPTS: Record<string, string[]> = {
  fr: [
    "Ma carte bancaire vient d'être volée — que faire en urgence ?",
    "Quels sont mes droits RGPD sur mes données bancaires ?",
    "Expliquez-moi la garantie des dépôts en France.",
    "Quels délais pour un virement SEPA international ?",
  ],
  de: [
    "Meine Karte wurde gestohlen — was muss ich sofort tun?",
    "Welche DSGVO-Rechte habe ich bezüglich meiner Bankdaten?",
    "Wie funktioniert die Einlagensicherung in Deutschland?",
    "Wie lange dauert eine internationale SEPA-Überweisung?",
  ],
  en: [
    "My card was just stolen — what should I do urgently?",
    "What are my GDPR rights regarding my banking data?",
    "Explain how deposit guarantees work in the EU.",
    "What are the timelines for an international SEPA transfer?",
  ],
};

export function ChatRoom() {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const composerRef = useRef<ChatComposerHandle>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

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

  // Scroll-to-bottom on new message unless user scrolled up.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottom || isStreaming) {
      scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isStreaming]);

  // Track scroll position for FAB.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Cleanup on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  const scrollToBottom = useCallback(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

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

  const suggestions = SUGGESTED_PROMPTS[locale] ?? SUGGESTED_PROMPTS.en ?? [];

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)]">
      {/* Header */}
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

      {/* Message list */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-8"
      >
        {messages.length === 0 ? (
          <EmptyWithSuggestions
            title={t("title")}
            description={t("description")}
            suggestionsLabel={t("startWith")}
            suggestions={suggestions}
            onSelect={(text) => {
              composerRef.current?.setValue(text);
              void sendMessage(text);
            }}
          />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {/* Typing indicator */}
            {isStreaming && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-center gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 dark:bg-gold-500">
                  <TypingDots />
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {t("thinking")}
                </span>
              </div>
            )}
            <div ref={scrollAnchorRef} aria-hidden />
          </div>
        )}

        {/* Scroll-to-bottom FAB */}
        {showScrollBtn && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label={t("scrollToBottom")}
            className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] shadow-md transition-all hover:bg-[var(--muted)] animate-in fade-in-0 zoom-in-90 duration-150"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Composer */}
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

interface EmptyWithSuggestionsProps {
  title: string;
  description: string;
  suggestionsLabel: string;
  suggestions: string[];
  onSelect: (text: string) => void;
}

function EmptyWithSuggestions({
  title,
  description,
  suggestionsLabel,
  suggestions,
  onSelect,
}: EmptyWithSuggestionsProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 py-12 text-center">
      {/* Icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-900 text-gold-400 shadow-lg dark:bg-gold-500 dark:text-navy-950">
        <Sparkles className="h-8 w-8" />
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
        <p className="max-w-sm text-sm text-[var(--muted-foreground)]">{description}</p>
      </div>

      {/* Suggested prompts */}
      <div className="w-full space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          {suggestionsLabel}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {suggestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelect(prompt)}
              className="group flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3 text-left text-sm text-[var(--foreground)] transition-colors hover:border-navy-300 hover:bg-navy-50 dark:hover:border-gold-700 dark:hover:bg-navy-900/40"
            >
              <ArrowDown className="mt-0.5 h-3.5 w-3.5 shrink-0 -rotate-90 text-[var(--muted-foreground)] transition-colors group-hover:text-navy-600 dark:group-hover:text-gold-400" />
              <span className="leading-snug">{prompt}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
