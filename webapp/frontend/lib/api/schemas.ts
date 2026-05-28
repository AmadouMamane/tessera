/**
 * Zod schemas that mirror the FastAPI response shapes.
 *
 * The schemas are the single source of truth for runtime validation *and*
 * type inference: every fetcher in this module pipes the response through
 * the matching schema's `.parse()` so that downstream UI never has to
 * defensively check shape.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const LocaleSchema = z.enum(["fr", "de", "en"]);
export type Locale = z.infer<typeof LocaleSchema>;

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export const ChatCitationSchema = z.object({
  source: z.string(),
  locator: z.string(),
  language: LocaleSchema,
});
export type ChatCitation = z.infer<typeof ChatCitationSchema>;

export const ChatStartEventSchema = z.object({
  conversation_id: z.string().uuid(),
  turn_id: z.string().uuid(),
});

export const ChatEndEventSchema = z.object({
  conversation_id: z.string().uuid(),
  turn_id: z.string().uuid(),
  language: LocaleSchema,
  final_response: z.string(),
  needs_escalation: z.boolean(),
  confidence: z.number().min(0).max(1).nullable(),
  citations: z.array(ChatCitationSchema),
  finish_reason: z.enum(["complete", "escalated", "error"]),
});
export type ChatEndEvent = z.infer<typeof ChatEndEventSchema>;

export const ChatErrorEventSchema = z.object({
  error: z.string(),
});

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const AuditOutcomeSchema = z.enum(["allowed", "denied", "error"]);
export type AuditOutcome = z.infer<typeof AuditOutcomeSchema>;

export const AuditDecisionSchema = z.object({
  target: z.string(),
  decision: z.enum(["allow", "deny", "transform"]),
  policy_rule: z.string(),
  rationale: z.string(),
  redactions: z.array(z.string()).default([]),
  occurred_at: z.string(),
});
export type AuditDecision = z.infer<typeof AuditDecisionSchema>;

export const AuditEntrySchema = z.object({
  occurred_at: z.string(),
  target: z.string(),
  outcome: AuditOutcomeSchema,
  arguments: z.record(z.string(), z.unknown()).default({}),
  decisions: z.array(AuditDecisionSchema).default([]),
  error: z.string().nullable().default(null),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const AuditPageSchema = z.object({
  entries: z.array(AuditEntrySchema),
  cursor: z.number().int().nonnegative(),
  has_more: z.boolean(),
});
export type AuditPage = z.infer<typeof AuditPageSchema>;

// ---------------------------------------------------------------------------
// Health + budget
// ---------------------------------------------------------------------------

export const HealthResponseSchema = z.object({
  status: z.string(),
  version: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const BudgetSnapshotSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  estimated_cost_eur: z.number().nonnegative(),
});
export type BudgetSnapshot = z.infer<typeof BudgetSnapshotSchema>;

// ---------------------------------------------------------------------------
// Eval scorecard (read from a local JSON artefact, not from the backend)
// ---------------------------------------------------------------------------

export const ScorecardResultSchema = z.object({
  case_id: z.string(),
  language: LocaleSchema,
  passed: z.boolean(),
  reasons: z.array(z.string()).default([]),
  final_response: z.string(),
  needs_escalation: z.boolean(),
  invoked_tools: z.array(z.string()).default([]),
});
export type ScorecardResult = z.infer<typeof ScorecardResultSchema>;

export const ScorecardSummarySchema = z.object({
  total: z.number().int(),
  passed: z.number().int(),
  failed: z.number().int(),
  pass_rate: z.number().min(0).max(1),
});
export type ScorecardSummary = z.infer<typeof ScorecardSummarySchema>;

export const ScorecardDocumentSchema = z.object({
  summary: ScorecardSummarySchema,
  results: z.array(ScorecardResultSchema),
});
export type ScorecardDocument = z.infer<typeof ScorecardDocumentSchema>;
