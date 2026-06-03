/**
 * Server-only loader for the eval scorecard.
 *
 * Two sources, tried in order:
 *
 *   1. The live repo reports — `eval/reports/` at the repository root, written
 *      by `scripts/run_eval.py`. Found by walking up from `process.cwd()` for a
 *      `pyproject.toml`. This is the source under `next dev` and on a checkout,
 *      so freshly produced runs show up immediately.
 *   2. A bundled fallback — `data/eval/` shipped inside the frontend image. The
 *      standalone Cloud Run image has no repo root (no `pyproject.toml`), so
 *      without this the dashboard would render an empty scorecard. The bundle
 *      is a curated, non-sensitive snapshot baked in at build time.
 */
import "server-only";

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  type RunMeta,
  RunMetaSchema,
  type ScorecardDocument,
  ScorecardDocumentSchema,
} from "@/lib/api/schemas";

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

/**
 * Resolve the directory holding the scorecard JSON files. Prefers the live repo
 * reports; falls back to the bundled snapshot (the only source in the deployed
 * image). Returns null only if neither exists.
 */
async function reportsDir(): Promise<string | null> {
  const root = await findRepoRoot(process.cwd());
  if (root) {
    const live = join(root, "eval", "reports");
    try {
      await stat(live);
      return live;
    } catch {
      // fall through to the bundle
    }
  }
  const bundled = join(process.cwd(), "data", "eval");
  try {
    await stat(bundled);
    return bundled;
  } catch {
    return null;
  }
}

export async function loadScorecard(filename?: string): Promise<ScorecardDocument | null> {
  const dir = await reportsDir();
  if (!dir) return null;
  const target = join(dir, filename ?? "latest.json");
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
  const dir = await reportsDir();
  if (!dir) return [];
  try {
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
