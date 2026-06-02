/**
 * Server-only loader for the eval scorecard.
 *
 * The scorecard is written by `scripts/run_eval.py` to
 * `eval/reports/latest.json` at the repository root. We locate it by walking
 * up from `process.cwd()` — works for both `next dev` (cwd is the frontend
 * directory) and the standalone Cloud Run image (cwd is the package root).
 */
import "server-only";

import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  type RunMeta,
  RunMetaSchema,
  type ScorecardDocument,
  ScorecardDocumentSchema,
} from "@/lib/api/schemas";

const RELATIVE_PATH = join("eval", "reports", "latest.json");

async function findRepoRoot(start: string): Promise<string | null> {
  let dir = resolve(start);
  while (true) {
    try {
      await stat(join(dir, "pyproject.toml"));
      return dir;
    } catch {
      // continue
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function loadScorecard(filename?: string): Promise<ScorecardDocument | null> {
  const root = await findRepoRoot(process.cwd());
  if (!root) return null;
  const target = filename ? join(root, "eval", "reports", filename) : join(root, RELATIVE_PATH);
  try {
    const raw = await readFile(target, "utf-8");
    const parsed = JSON.parse(raw);
    return ScorecardDocumentSchema.parse(parsed);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function loadAllRuns(): Promise<RunMeta[]> {
  const root = await findRepoRoot(process.cwd());
  if (!root) return [];
  const dir = join(root, "eval", "reports");
  try {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(dir);
    const runs: RunMeta[] = [];
    for (const file of files
      .filter((f) => /^\d{8}T\d{6}Z.*\.json$/.test(f))
      .sort()
      .reverse()) {
      try {
        const raw = await readFile(join(dir, file), "utf-8");
        const doc = ScorecardDocumentSchema.parse(JSON.parse(raw));
        runs.push(
          RunMetaSchema.parse({
            filename: file,
            run_at: doc.run_at ?? file.replace(".json", ""),
            lang: doc.lang ?? null,
            model: doc.model ?? null,
            summary: doc.summary,
          }),
        );
      } catch {
        // skip malformed files
      }
    }
    return runs;
  } catch {
    return [];
  }
}
