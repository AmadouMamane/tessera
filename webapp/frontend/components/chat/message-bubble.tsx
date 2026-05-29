"use client";

import { AlertTriangle, BookOpen, Bot, Check, Copy, User2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Markdown } from "./markdown";
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
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <article
      className={cn(
        "group flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
      aria-label={isUser ? t("youSaid") : t("assistantSaid")}
    >
      {/* Avatar */}
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

      {/* Content column */}
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1.5",
          isUser ? "items-end" : "items-start",
        )}
      >
        {/* Name + badges */}
        <div className="flex items-baseline gap-2 px-1">
          <span className="text-xs font-medium text-[var(--foreground)]">
            {isUser ? t("youSaid") : t("assistantSaid")}
          </span>
          {message.needsEscalation && (
            <Badge tone="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t("escalated")}
            </Badge>
          )}
          {!isUser && typeof message.confidence === "number" && (
            <ConfidenceBadge value={message.confidence} />
          )}
        </div>

        {/* Bubble */}
        <div
          className={cn(
            "relative rounded-2xl px-4 py-2.5 shadow-[var(--shadow-card)]",
            isUser
              ? "bg-navy-900 text-navy-50 dark:bg-gold-500 dark:text-navy-950 text-sm leading-relaxed"
              : "bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)]",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-pretty text-sm leading-relaxed">
              {message.content}
            </p>
          ) : (
            <>
              <Markdown>
                {message.content}
              </Markdown>
              {/* Blinking cursor while tokens are still arriving */}
              {message.content !== "" && !message.citations && (
                <span
                  aria-hidden
                  className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 animate-pulse bg-current opacity-60"
                />
              )}
              {/* Copy button — visible on hover */}
              {message.content && (
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label={copied ? t("copied") : t("copy")}
                  className={cn(
                    "absolute -top-2.5 right-2 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] shadow-sm transition-all duration-150",
                    "opacity-0 group-hover:opacity-100",
                    copied && "text-green-600 dark:text-green-400",
                  )}
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <CitationPills citations={message.citations} sourcesLabel={t("sources")} />
        )}
      </div>
    </article>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.7 ? "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/40 border-green-200 dark:border-green-800"
    : value >= 0.4 ? "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
    : "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/40 border-red-200 dark:border-red-800";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-px text-[0.65rem] font-medium tabular-nums",
        tone,
      )}
    >
      {pct}%
    </span>
  );
}

function CitationPills({
  citations,
  sourcesLabel,
}: {
  citations: NonNullable<ChatMessage["citations"]>;
  sourcesLabel: string;
}) {
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-[0.65rem] text-[var(--muted-foreground)]">
        <BookOpen className="h-3 w-3" />
        {sourcesLabel}
      </span>
      {citations.map((c, idx) => (
        <span
          key={`${c.source}-${c.locator}-${idx}`}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)]/40 px-2 py-0.5 text-[0.65rem] text-[var(--foreground)]"
        >
          <span className="font-medium">{c.source}</span>
          {c.locator && (
            <span className="text-[var(--muted-foreground)]">{c.locator}</span>
          )}
        </span>
      ))}
    </div>
  );
}
