"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, CircleDollarSign, Heart, ServerCog } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchBudget, fetchHealth, fetchReadiness } from "@/lib/api/client";

const POLL_MS = 10_000;

export function HealthDashboard() {
  const t = useTranslations("health");

  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: POLL_MS,
  });

  const readiness = useQuery({
    queryKey: ["readiness"],
    queryFn: ({ signal }) => fetchReadiness(signal),
    refetchInterval: POLL_MS,
  });

  const budget = useQuery({
    queryKey: ["budget"],
    queryFn: ({ signal }) => fetchBudget(signal),
    refetchInterval: POLL_MS,
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatusCard
        title={t("cards.backend")}
        icon={<ServerCog />}
        loading={health.isPending}
        error={health.error?.message}
        status={health.data?.status}
        helper={health.data?.version ? `v${health.data.version}` : undefined}
      />
      <StatusCard
        title={t("cards.readiness")}
        icon={<Heart />}
        loading={readiness.isPending}
        error={readiness.error?.message}
        status={readiness.data?.status}
      />
      <StatusCard
        title={t("cards.budget")}
        icon={<CircleDollarSign />}
        loading={budget.isPending}
        error={budget.error?.message}
        custom={
          budget.data ? (
            <div className="flex flex-col gap-1">
              <span className="font-serif text-2xl font-semibold">
                € {budget.data.estimated_cost_eur.toFixed(4)}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {budget.data.input_tokens.toLocaleString()} in ·{" "}
                {budget.data.output_tokens.toLocaleString()} out
              </span>
            </div>
          ) : null
        }
      />
      <StatusCard
        title={t("cards.version")}
        icon={<Activity />}
        loading={health.isPending}
        error={health.error?.message}
        custom={
          health.data ? (
            <span className="font-mono text-base font-medium">{health.data.version}</span>
          ) : null
        }
      />
    </div>
  );
}

interface StatusCardProps {
  title: string;
  icon: ReactNode;
  loading: boolean;
  error?: string | undefined;
  status?: string;
  helper?: string;
  custom?: ReactNode;
}

function StatusCard({ title, icon, loading, error, status, helper, custom }: StatusCardProps) {
  const t = useTranslations("health");
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-elevated)]">
      {/* premium top hairline + corner glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold-500/[0.06] blur-2xl transition-all duration-500 group-hover:bg-gold-500/[0.12]" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-sans text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          {title}
        </CardTitle>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-navy-800 to-navy-950 text-gold-400 shadow-[inset_0_1px_1px_oklch(0.7_0.12_195/0.2)] ring-1 ring-gold-500/15 transition-transform duration-300 group-hover:scale-105 dark:from-gold-500/15 dark:to-gold-500/5 dark:ring-gold-400/20 [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : error ? (
          <Badge tone="danger">{t("status.down")}</Badge>
        ) : custom ? (
          custom
        ) : (
          <div className="flex items-center gap-2">
            <Badge tone="success">{status ?? "ok"}</Badge>
            {helper ? (
              <span className="text-xs text-[var(--muted-foreground)]">{helper}</span>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
