"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
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

const PAGE_SIZE = 5;

type SortKey = "date" | "cases" | "passed" | "pass_rate";
type SortDir = "asc" | "desc";

function formatRunAt(raw: string): string {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (!m) return raw;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
  return sortDir === "asc"
    ? <ArrowUp className="ml-1 inline h-3 w-3 text-[var(--foreground)]" />
    : <ArrowDown className="ml-1 inline h-3 w-3 text-[var(--foreground)]" />;
}

interface RunHistoryPanelProps {
  runs: RunMeta[];
  currentFile?: string;
}

export function RunHistoryPanel({ runs, currentFile }: RunHistoryPanelProps) {
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
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--muted-foreground)]" />
            <span className="text-sm font-medium">Run history</span>
            <span className="text-xs text-[var(--muted-foreground)]">
              ({runs.length} run{runs.length !== 1 ? "s" : ""})
            </span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                aria-label="Previous page"
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
                aria-label="Next page"
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
                <TableHead style={{ width: "20%" }}>
                  <button
                    onClick={() => handleSort("date")}
                    className="flex cursor-pointer items-center whitespace-nowrap hover:text-[var(--foreground)]"
                  >
                    Run
                    <SortIcon col="date" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead style={{ width: "14%" }} className="whitespace-nowrap text-center">Lang</TableHead>
                <TableHead style={{ width: "14%" }} className="whitespace-nowrap text-center">
                  <button
                    onClick={() => handleSort("cases")}
                    className="flex w-full cursor-pointer items-center justify-center hover:text-[var(--foreground)]"
                  >
                    Cases
                    <SortIcon col="cases" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead style={{ width: "14%" }} className="whitespace-nowrap text-center">
                  <button
                    onClick={() => handleSort("passed")}
                    className="flex w-full cursor-pointer items-center justify-center hover:text-[var(--foreground)]"
                  >
                    Passed
                    <SortIcon col="passed" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead style={{ width: "14%" }} className="whitespace-nowrap text-center">
                  <button
                    onClick={() => handleSort("pass_rate")}
                    className="flex w-full cursor-pointer items-center justify-center whitespace-nowrap hover:text-[var(--foreground)]"
                  >
                    Pass rate
                    <SortIcon col="pass_rate" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead style={{ width: "22%" }} className="whitespace-nowrap text-center pr-24">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRuns.map((run, localIdx) => {
                const globalIdx = page * PAGE_SIZE + localIdx;
                // Trend is always relative to original order (date desc), not current sort
                const originalIdx = runs.findIndex((r) => r.filename === run.filename);
                const prev = runs[originalIdx + 1];
                const delta = prev
                  ? run.summary.pass_rate - prev.summary.pass_rate
                  : null;
                const isCurrent = !currentFile
                  ? globalIdx === 0
                  : run.filename === currentFile;
                return (
                  <TableRow
                    key={run.filename}
                    className={
                      isCurrent
                        ? "bg-[var(--muted)]/30"
                        : "hover:bg-[var(--muted)]/10 cursor-pointer"
                    }
                  >
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`?run=${run.filename}`}
                        className="hover:underline"
                      >
                        {formatRunAt(run.run_at)}
                      </Link>
                      {isCurrent && (
                        <Badge tone="info" className="ml-2 text-[10px]">
                          current
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge tone="neutral">
                        {run.lang?.toUpperCase() ?? "ALL"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{run.summary.total}</TableCell>
                    <TableCell className="text-center">{run.summary.passed}</TableCell>
                    <TableCell className="text-center font-semibold">
                      {(run.summary.pass_rate * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-center pr-24">
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
