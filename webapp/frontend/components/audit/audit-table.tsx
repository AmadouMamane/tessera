"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ShieldAlert, ShieldCheck, ShieldOff, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchAudit } from "@/lib/api/client";
import type { AuditEntry, AuditOutcome } from "@/lib/api/schemas";

const PAGE_SIZE = 20;
const OUTCOMES: ReadonlyArray<AuditOutcome> = ["allowed", "denied", "error"];

export function AuditTable() {
  const t = useTranslations("audit");
  const tCommon = useTranslations("common");
  const formatter = useFormatter();

  const [cursor, setCursor] = useState(0);
  const [target, setTarget] = useState("");
  const [outcome, setOutcome] = useState<AuditOutcome | "all">("all");
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const query = useQuery({
    queryKey: ["audit", cursor, target, outcome],
    queryFn: ({ signal }) =>
      fetchAudit({
        cursor,
        limit: PAGE_SIZE,
        target: target || undefined,
        outcome: outcome === "all" ? undefined : outcome,
        signal,
      }),
    placeholderData: (prev) => prev,
  });

  const entries = query.data?.entries ?? [];

  return (
    <Card>
      <CardContent className="p-0">
        <Filters
          target={target}
          outcome={outcome}
          onTargetChange={(value) => {
            setCursor(0);
            setTarget(value);
          }}
          onOutcomeChange={(value) => {
            setCursor(0);
            setOutcome(value);
          }}
        />

        {query.isPending ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : entries.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<ShieldCheck />}
              title={tCommon("empty")}
              description={t("description")}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.occurredAt")}</TableHead>
                <TableHead>{t("columns.target")}</TableHead>
                <TableHead>{t("columns.outcome")}</TableHead>
                <TableHead className="text-right">
                  {t("columns.decisions")}
                </TableHead>
                <TableHead aria-label="actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, idx) => (
                <TableRow
                  key={`${entry.occurred_at}-${idx}`}
                  className="group cursor-pointer transition-colors hover:bg-[var(--muted)]/40"
                  onClick={() => setSelected(entry)}
                >
                  <TableCell className="font-mono text-xs">
                    {formatter.dateTime(new Date(entry.occurred_at), {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{entry.target}</span>
                  </TableCell>
                  <TableCell>
                    <OutcomeBadge outcome={entry.outcome} />
                  </TableCell>
                  <TableCell className="text-right text-xs text-[var(--muted-foreground)]">
                    {entry.decisions.length}
                  </TableCell>
                  <TableCell className="w-8 text-right">
                    <ChevronRight className="ml-auto h-4 w-4 text-[var(--muted-foreground)] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination
          cursor={cursor}
          pageSize={PAGE_SIZE}
          hasMore={query.data?.has_more ?? false}
          onPrevious={() => setCursor((c) => Math.max(0, c - PAGE_SIZE))}
          onNext={() => setCursor((c) => c + PAGE_SIZE)}
        />
      </CardContent>
      {selected ? (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-30 bg-[var(--background)]/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
            onClick={() => setSelected(null)}
          />
          <DetailsDrawer entry={selected} onClose={() => setSelected(null)} />
        </>
      ) : null}
    </Card>
  );
}

function Filters({
  target,
  outcome,
  onTargetChange,
  onOutcomeChange,
}: {
  target: string;
  outcome: AuditOutcome | "all";
  onTargetChange: (value: string) => void;
  onOutcomeChange: (value: AuditOutcome | "all") => void;
}) {
  const t = useTranslations("audit");
  const tCommon = useTranslations("common");
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-5 py-3">
      <Input
        type="search"
        value={target}
        onChange={(e) => onTargetChange(e.target.value)}
        placeholder={t("filters.target")}
        className="max-w-xs"
        aria-label={t("filters.target")}
      />
      <Select
        value={outcome}
        onValueChange={(v) => onOutcomeChange(v as AuditOutcome | "all")}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder={t("filters.outcome")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{tCommon("all")}</SelectItem>
          {OUTCOMES.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {t(`outcomes.${opt}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: AuditOutcome }) {
  const t = useTranslations("audit.outcomes");
  if (outcome === "allowed")
    return (
      <Badge tone="success" className="gap-1">
        <ShieldCheck className="h-3 w-3" /> {t("allowed")}
      </Badge>
    );
  if (outcome === "denied")
    return (
      <Badge tone="danger" className="gap-1">
        <ShieldOff className="h-3 w-3" /> {t("denied")}
      </Badge>
    );
  return (
    <Badge tone="warning" className="gap-1">
      <ShieldAlert className="h-3 w-3" /> {t("error")}
    </Badge>
  );
}

function Pagination({
  cursor,
  pageSize,
  hasMore,
  onPrevious,
  onNext,
}: {
  cursor: number;
  pageSize: number;
  hasMore: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("common");
  return (
    <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
      <p className="text-xs text-[var(--muted-foreground)]">
        {cursor + 1} – {cursor + pageSize}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={cursor === 0}
        >
          <ChevronLeft className="h-4 w-4" />
          {t("previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasMore}
        >
          {t("next")}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function DetailsDrawer({
  entry,
  onClose,
}: {
  entry: AuditEntry;
  onClose: () => void;
}) {
  const t = useTranslations("common");
  const tAudit = useTranslations("audit");
  const formatter = useFormatter();

  return (
    <div className="animate-in slide-in-from-right-full fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card-elevated)] duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <OutcomeBadge outcome={entry.outcome} />
          <p className="font-serif text-sm font-semibold">{entry.target}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("close")}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Meta row */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <span className="font-mono tabular-nums">
            {formatter.dateTime(new Date(entry.occurred_at), {
              dateStyle: "medium",
              timeStyle: "medium",
            })}
          </span>
        </div>

        {/* Decisions */}
        {entry.decisions.length > 0 && (
          <section>
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {tAudit("columns.decisions")}
            </p>
            <ul className="space-y-2">
              {entry.decisions.map((d, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium text-[var(--foreground)]">{d.policy_rule}</span>
                    <span className={d.decision === "allow"
                      ? "font-medium text-green-700 dark:text-green-400"
                      : d.decision === "deny"
                        ? "font-medium text-red-700 dark:text-red-400"
                        : "font-medium text-amber-700 dark:text-amber-400"
                    }>
                      {d.decision}
                    </span>
                  </div>
                  {d.rationale && (
                    <p className="mt-1 leading-relaxed text-[var(--muted-foreground)]">{d.rationale}</p>
                  )}
                  {d.redactions.length > 0 && (
                    <p className="mt-1 text-[var(--muted-foreground)]/60">
                      Redacted: {d.redactions.join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Raw payload — collapsible */}
        <section>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Payload
          </p>
          <pre className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2.5 font-mono text-[0.72rem] leading-relaxed text-[var(--foreground)] dark:bg-navy-800/60">
            {JSON.stringify(entry, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}
