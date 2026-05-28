"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ShieldOff, ShieldCheck, ShieldAlert, X } from "lucide-react";
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

const PAGE_SIZE = 50;
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
                  className="cursor-pointer"
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
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" tabIndex={-1}>
                      {tCommon("details")}
                    </Button>
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
        <DetailsDrawer entry={selected} onClose={() => setSelected(null)} />
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
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
        <p className="font-serif text-sm font-semibold">{entry.target}</p>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("close")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <pre className="max-h-[80vh] overflow-auto p-5 font-mono text-xs leading-relaxed text-[var(--foreground)]">
        {JSON.stringify(entry, null, 2)}
      </pre>
    </div>
  );
}
