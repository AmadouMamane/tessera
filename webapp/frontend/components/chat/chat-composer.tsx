"use client";

import { Send, StopCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ChatComposerHandle {
  focus: () => void;
  setValue: (text: string) => void;
}

interface ChatComposerProps {
  disabled?: boolean;
  isStreaming?: boolean;
  onSubmit: (message: string) => void | Promise<void>;
  onAbort?: () => void;
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  ({ disabled, isStreaming, onSubmit, onAbort }, ref) => {
    const t = useTranslations("chat");
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [value, setValue] = useState("");

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      setValue: (text: string) => {
        setValue(text);
        textareaRef.current?.focus();
      },
    }));

    // Auto-resize: grow with content, cap at 160px.
    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [value]);

    function submit() {
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      setValue("");
      void onSubmit(trimmed);
    }

    function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    }

    return (
      <div className="border-t border-[var(--border)] bg-[var(--card)]">
        <form
          className="mx-auto flex max-w-3xl items-end gap-2 px-4 pt-3 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t("placeholder")}
            disabled={disabled}
            rows={1}
            className="min-h-[44px] resize-none overflow-hidden"
            aria-label={t("placeholder")}
          />
          {isStreaming && onAbort ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onAbort}
              aria-label="Stop"
              className="shrink-0"
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              size="icon"
              disabled={disabled || value.trim().length === 0}
              aria-label={t("send")}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
        <p className="mx-auto max-w-3xl px-5 pb-3 text-[0.65rem] text-[var(--muted-foreground)]">
          {t("composerHint")}
        </p>
      </div>
    );
  },
);
ChatComposer.displayName = "ChatComposer";
