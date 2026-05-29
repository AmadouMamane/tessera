"use client";

import { AlertTriangle, BookOpen, Bot, User2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/lib/stores/chat-store";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const t = useTranslations("chat");
  const isUser = message.role === "user";
  const Avatar = isUser ? User2 : Bot;

  return (
    <article
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
      aria-label={isUser ? t("youSaid") : t("assistantSaid")}
    >
      <div
        aria-hidden
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-[var(--secondary)] text-[var(--foreground)]"
            : "bg-navy-900 text-gold-400 dark:bg-gold-500 dark:text-navy-950",
        )}
      >
        <Avatar className="h-4 w-4" />
      </div>
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1.5",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div className="flex items-baseline gap-2 px-1">
          <span className="text-xs font-medium text-[var(--foreground)]">
            {isUser ? t("youSaid") : t("assistantSaid")}
          </span>
          {message.needsEscalation ? (
            <Badge tone="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t("escalated")}
            </Badge>
          ) : null}
        </div>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-[var(--shadow-card)]",
            isUser
              ? "bg-navy-900 text-navy-50 dark:bg-gold-500 dark:text-navy-950"
              : "bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)]",
          )}
        >
          <p className="whitespace-pre-wrap text-pretty">
            {message.content}
            {/* Blinking cursor while tokens are still arriving */}
            {!isUser && message.content !== "" && !message.citations && (
              <span
                aria-hidden
                className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-current opacity-70"
              />
            )}
          </p>
        </div>

        {message.citations && message.citations.length > 0 ? (
          <CitationList citations={message.citations} />
        ) : null}

        {typeof message.confidence === "number" ? (
          <div className="px-1 text-[0.7rem] text-[var(--muted-foreground)]">
            {t("confidence")}: {(message.confidence * 100).toFixed(0)}%
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CitationList({
  citations,
}: {
  citations: NonNullable<ChatMessage["citations"]>;
}) {
  const t = useTranslations("chat");
  return (
    <div className="mt-1 flex flex-col gap-1 rounded-md border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
        <BookOpen className="h-3 w-3" />
        {t("sources")}
      </div>
      <ul className="space-y-1 text-xs text-[var(--foreground)]">
        {citations.map((citation, idx) => (
          <li key={`${citation.source}-${citation.locator}-${idx}`}>
            <span className="font-medium">{citation.source}</span>
            <span className="ml-1 text-[var(--muted-foreground)]">
              {citation.locator}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
