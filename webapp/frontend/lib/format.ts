/** Client-safe formatting helpers (no server imports). */

/** Compact run timestamp: "20260601T233600Z" → "01/06 23:36". */
export function shortRunDate(runAt?: string | null): string {
  if (!runAt) return "";
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(runAt);
  if (!m) return runAt;
  return `${m[3]}/${m[2]} ${m[4]}:${m[5]}`;
}
