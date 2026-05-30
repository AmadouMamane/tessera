"use client";

import { AlertTriangle, BookOpen, Check, Copy, Sparkles, User2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Markdown } from "./markdown";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/lib/stores/chat-store";

interface MessageBubbleProps {
  message: ChatMessage;
  isGrouped?: boolean;
  isFirst?: boolean;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message, isGrouped = false, isFirst = false }: MessageBubbleProps) {
  const t = useTranslations("chat");
  const isUser = message.role === "user";
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
        "group flex w-full gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
        !isFirst && (isGrouped ? "mt-1" : "mt-5"),
        isUser ? "flex-row-reverse" : "flex-row",
      )}
      aria-label={isUser ? t("youSaid") : t("assistantSaid")}
    >
      {/* Avatar — invisible spacer when grouped to preserve alignment */}
      {isGrouped ? (
        <div aria-hidden className="mt-0.5 w-8 shrink-0" />
      ) : (
        <div
          aria-hidden
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            isUser
              ? "bg-[var(--secondary)] text-[var(--muted-foreground)]"
              : "bg-navy-900 text-gold-400 dark:bg-gold-500 dark:text-navy-950",
          )}
        >
          {isUser ? <User2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </div>
      )}

      {/* Content column — no items-start/end: default stretch makes children always fill the column */}
      <div className="flex w-[80%] flex-col gap-1.5">
        {/* Name + timestamp + badges — hidden for grouped messages */}
        {!isGrouped && (
          <div className={cn("flex items-baseline gap-2 px-1", isUser && "justify-end")}>
            <span className="text-[0.7rem] font-medium text-[var(--muted-foreground)]">
              {isUser ? t("youSaid") : t("assistantSaid")}
            </span>
            <span className="text-[0.62rem] tabular-nums text-[var(--muted-foreground)]/40">
              {formatTime(message.createdAt)}
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
        )}

        {/* Bubble — w-full keeps width stable during streaming */}
        <div
          className={cn(
            "relative w-full",
            isUser
              ? "px-4 py-2.5 rounded-2xl rounded-br-sm bg-gradient-to-br from-navy-800 to-navy-950 text-navy-50 dark:from-gold-400 dark:to-gold-500 dark:text-navy-950 text-sm leading-relaxed shadow-[var(--shadow-card)]"
              : "text-[var(--foreground)]",
          )}
        >

          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-justify hyphens-auto">
              {message.content}
            </p>
          ) : (
            <Markdown trailingCursor={message.content !== "" && !message.citations}>
              {message.content}
            </Markdown>
          )}
        </div>

        {/* Copy — self-start prevents it from stretching to full column width */}
        {!isUser && message.content && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? t("copied") : t("copy")}
            className={cn(
              "self-start flex items-center gap-1 px-1 text-[0.62rem] transition-all duration-150",
              "text-[var(--muted-foreground)]/40 hover:text-[var(--muted-foreground)]",
              "opacity-0 group-hover:opacity-100",
              copied && "!opacity-100 text-green-600 dark:text-green-400",
            )}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? t("copied") : t("copy")}
          </button>
        )}

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
    value >= 0.7
      ? "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/40 border-green-200 dark:border-green-800"
      : value >= 0.4
        ? "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
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
    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 px-1">
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
