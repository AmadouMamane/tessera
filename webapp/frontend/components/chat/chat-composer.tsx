"use client";

import { Send, StopCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ChatComposerHandle {
  focus: () => void;
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
    }));

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
          className="mx-auto flex max-w-3xl items-end gap-2 px-4 py-4"
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
            className="min-h-[44px] max-h-40 resize-none"
            aria-label={t("placeholder")}
          />
          {isStreaming && onAbort ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onAbort}
              aria-label="Stop"
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
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    );
  },
);
ChatComposer.displayName = "ChatComposer";
