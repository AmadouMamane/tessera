"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Layers,
  TrendingUp,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RunMeta } from "@/lib/api/schemas";
import { findModel } from "@/lib/models";

// 4 per page so the prev/next pager stays available once there are 5+ runs
// (one report per model), instead of collapsing into a single static page.
const PAGE_SIZE = 4;

type SortKey = "date" | "cases" | "passed" | "pass_rate";
type SortDir = "asc" | "desc";

function formatRunAt(raw: string): string {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (!m) return raw;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
  return sortDir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3 text-[var(--foreground)]" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3 text-[var(--foreground)]" />
  );
}

interface RunHistoryPanelProps {
  runs: RunMeta[];
  currentFile?: string;
}

export function RunHistoryPanel({ runs, currentFile }: RunHistoryPanelProps) {
  const t = useTranslations("eval.runHistory");
  const tEval = useTranslations("eval");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...runs];
    copy.sort((a, b) => {
      let diff: number;
      switch (sortKey) {
        case "date":
          diff = a.run_at.localeCompare(b.run_at);
          break;
        case "cases":
          diff = a.summary.total - b.summary.total;
          break;
        case "passed":
          diff = a.summary.passed - b.summary.passed;
          break;
        case "pass_rate":
          diff = a.summary.pass_rate - b.summary.pass_rate;
          break;
      }
      return sortDir === "asc" ? diff : -diff;
    });
    return copy;
  }, [runs, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRuns = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      setSortDir("desc");
    }
    setPage(0);
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-gradient-to-b from-[var(--muted)]/40 to-transparent px-5 py-3.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gold-500 dark:text-gold-400" />
            <span className="text-sm font-medium">{t("title")}</span>
            <span className="text-xs text-[var(--muted-foreground)]">
              ({runs.length} {runs.length !== 1 ? t("runPlural") : t("runSingular")})
            </span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                aria-label={t("prevPage")}
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-[4rem] text-center text-xs text-[var(--muted-foreground)]">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
                aria-label={t("nextPage")}
              >
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: "22%" }}>
                  <button
                    type="button"
                    onClick={() => handleSort("date")}
                    className="flex cursor-pointer items-center whitespace-nowrap hover:text-[var(--foreground)]"
                  >
                    {t("columns.run")}
                    <SortIcon col="date" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead style={{ width: "15%" }} className="whitespace-nowrap text-center">
                  {t("columns.lang")}
                </TableHead>
                <TableHead style={{ width: "15%" }} className="whitespace-nowrap text-center">
                  <button
                    type="button"
                    onClick={() => handleSort("cases")}
                    className="flex w-full cursor-pointer items-center justify-center hover:text-[var(--foreground)]"
                  >
                    {t("columns.cases")}
                    <SortIcon col="cases" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead style={{ width: "15%" }} className="whitespace-nowrap text-center">
                  <button
                    type="button"
                    onClick={() => handleSort("passed")}
                    className="flex w-full cursor-pointer items-center justify-center hover:text-[var(--foreground)]"
                  >
                    {t("columns.passed")}
                    <SortIcon col="passed" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead style={{ width: "15%" }} className="whitespace-nowrap text-center">
                  <button
                    type="button"
                    onClick={() => handleSort("pass_rate")}
                    className="flex w-full cursor-pointer items-center justify-center whitespace-nowrap hover:text-[var(--foreground)]"
                  >
                    {t("columns.passRate")}
                    <SortIcon col="pass_rate" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead style={{ width: "18%" }} className="whitespace-nowrap text-center pr-16">
                  {t("columns.trend")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRuns.map((run, localIdx) => {
                const globalIdx = page * PAGE_SIZE + localIdx;
                // Trend is always relative to original order (date desc), not current sort
                const originalIdx = runs.findIndex((r) => r.filename === run.filename);
                const prev = runs[originalIdx + 1];
                const delta = prev ? run.summary.pass_rate - prev.summary.pass_rate : null;
                const isCurrent = !currentFile ? globalIdx === 0 : run.filename === currentFile;
                return (
                  <TableRow
                    key={run.filename}
                    className={
                      isCurrent
                        ? "border-l-2 border-l-gold-500/70 bg-[var(--muted)]/30 dark:border-l-gold-400/60"
                        : "cursor-pointer transition-colors hover:bg-[var(--muted)]/20"
                    }
                  >
                    <TableCell className="font-mono text-xs">
                      <Link href={`?run=${run.filename}`} className="hover:underline">
                        {formatRunAt(run.run_at)}
                      </Link>
                      {isCurrent && (
                        <Badge tone="info" className="ml-2 text-[10px]">
                          {t("current")}
                        </Badge>
                      )}
                      {run.model ? (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                          <Cpu className="h-3 w-3 text-gold-500" />
                          {findModel(run.model).label}
                        </div>
                      ) : null}
                      {/* Catalogue size (human-readable); the exact version hash is
                          in the tooltip. Distinguishes runs scored on different sets. */}
                      <div
                        title={run.catalogue_version ?? undefined}
                        className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]/70"
                      >
                        <Layers className="h-3 w-3" />
                        {tEval("catalogue", {
                          count: run.catalogue_version
                            ? Number.parseInt(run.catalogue_version, 10)
                            : run.summary.total,
                        })}
                        {run.catalogue_version?.includes("legacy") ? " · legacy" : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge tone="neutral">{run.lang?.toUpperCase() ?? "ALL"}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{run.summary.total}</TableCell>
                    <TableCell className="text-center">{run.summary.passed}</TableCell>
                    <TableCell className="text-center font-semibold">
                      {(run.summary.pass_rate * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-center pr-16">
                      {delta !== null ? (
                        <span
                          className={
                            delta > 0
                              ? "text-green-600 dark:text-green-400"
                              : delta < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-[var(--muted-foreground)]"
                          }
                        >
                          {delta > 0 ? "+" : ""}
                          {(delta * 100).toFixed(0)}pp
                        </span>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
