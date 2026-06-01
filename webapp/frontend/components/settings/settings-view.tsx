"use client";

import { useQuery } from "@tanstack/react-query";
import { Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_LABELS, type Locale, routing } from "@/i18n/routing";
import { fetchHealth } from "@/lib/api/client";
import { cn } from "@/lib/cn";

const REDUCE_MOTION_KEY = "tessera.reduceMotion";
const CHAT_MODEL_KEY = "tessera.chatModel";
const CHAT_MODELS: SegmentOption[] = [
  { value: "llama3.3:70b", label: "Llama 3.3 70B" },
  { value: "gemma3:27b", label: "Gemma 3 27B" },
];
const DEFAULT_CHAT_MODEL = "llama3.3:70b";

interface SegmentOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

function Segmented({
  options,
  value,
  onChange,
  disabled,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
              active
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        checked ? "bg-blue-600" : "bg-[var(--muted)]",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function Row({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--foreground)]">{title}</span>
        {hint ? <span className="text-xs text-[var(--muted-foreground)]">{hint}</span> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsView() {
  const t = useTranslations("settings");
  const tTheme = useTranslations("common.theme");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [chatModel, setChatModel] = useState(DEFAULT_CHAT_MODEL);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem(REDUCE_MOTION_KEY) === "1";
    setReduceMotion(stored);
    document.documentElement.classList.toggle("reduce-motion", stored);
    const storedModel = window.localStorage.getItem(CHAT_MODEL_KEY);
    if (storedModel && CHAT_MODELS.some((m) => m.value === storedModel)) {
      setChatModel(storedModel);
    }
  }, []);

  function changeMotion(next: boolean) {
    setReduceMotion(next);
    window.localStorage.setItem(REDUCE_MOTION_KEY, next ? "1" : "0");
    document.documentElement.classList.toggle("reduce-motion", next);
  }

  function changeModel(next: string) {
    setChatModel(next);
    window.localStorage.setItem(CHAT_MODEL_KEY, next);
  }

  function changeLocale(next: string) {
    if (next === locale) return;
    startTransition(() => router.replace(pathname, { locale: next as Locale }));
  }

  const health = useQuery({
    queryKey: ["health-settings"],
    queryFn: ({ signal }) => fetchHealth(signal),
    staleTime: 30_000,
    retry: 1,
  });
  const serviceUp = !health.isError && health.data?.status !== "down";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("appearance")}</CardTitle>
          <CardDescription>{t("appearanceHint")}</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-[var(--border)] pt-0">
          <Row title={t("theme")}>
            <Segmented
              value={mounted ? (theme ?? "system") : "system"}
              onChange={setTheme}
              options={[
                { value: "light", label: tTheme("light"), icon: <Sun className="h-4 w-4" /> },
                { value: "dark", label: tTheme("dark"), icon: <Moon className="h-4 w-4" /> },
                { value: "system", label: tTheme("system"), icon: <Monitor className="h-4 w-4" /> },
              ]}
            />
          </Row>
          <Row title={t("language")}>
            <Segmented
              value={locale}
              disabled={isPending}
              onChange={changeLocale}
              options={routing.locales.map((l) => ({ value: l, label: LOCALE_LABELS[l].short }))}
            />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("display")}</CardTitle>
          <CardDescription>{t("displayHint")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Row title={t("reduceMotion")} hint={t("reduceMotionHint")}>
            <Toggle checked={reduceMotion} onChange={changeMotion} label={t("reduceMotion")} />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("model")}</CardTitle>
          <CardDescription>{t("modelHint")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Row title={t("model")}>
            <Segmented
              value={mounted ? chatModel : DEFAULT_CHAT_MODEL}
              onChange={changeModel}
              options={CHAT_MODELS}
            />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("platform")}</CardTitle>
          <CardDescription>{t("platformHint")}</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-[var(--border)] pt-0">
          <Row title={t("service")}>
            {health.isPending ? (
              <span className="text-sm text-[var(--muted-foreground)]">…</span>
            ) : (
              <Badge tone={serviceUp ? "success" : "danger"}>
                {serviceUp ? t("statusOk") : t("statusDown")}
              </Badge>
            )}
          </Row>
          <Row title={t("version")}>
            <span className="font-mono text-sm text-[var(--muted-foreground)]">
              {health.data?.version ?? "—"}
            </span>
          </Row>
          <Row title={t("environment")}>
            <Badge tone="info">{t("environmentValue")}</Badge>
          </Row>
        </CardContent>
      </Card>
    </div>
  );
}
