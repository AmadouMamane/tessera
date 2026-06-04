/**
 * Single source of truth for the selectable chat models.
 *
 * Shared by the Settings model picker and the topbar model badge so the two
 * never drift. The user's choice is persisted in localStorage and broadcast
 * via a custom event (localStorage `storage` events don't fire in the tab that
 * made the change, so we dispatch our own for same-tab reactivity).
 */

export const CHAT_MODEL_KEY = "tessera.chatModel";
export const CHAT_MODEL_EVENT = "tessera:chatmodelchange";

export interface ChatModelMeta {
  /** Model id sent to the backend; routed to the matching backend by the registry. */
  id: string;
  /** Human-readable display name. */
  label: string;
  /** Parameter count, e.g. "70B". */
  params: string;
  /** Context window, e.g. "128K". */
  context: string;
  /** i18n key for the one-line characterisation shown on the Settings card. */
  tagKey: string;
  /** Where the model runs: local Ollama GPU vs the OpenAI frontier API. */
  provider: "ollama" | "openai";
  /**
   * Paid/frontier model gated to the superadmin: visible to everyone (so the
   * integration is on show) but only the superadmin may select and run it. The
   * real lock is enforced server-side in the /api/chat proxy — UI gating alone
   * is bypassable.
   */
  gated?: boolean;
}

// Ordered fastest → most capable. The first entry is the default (fastest),
// applied for every user until they pick another in Settings.
export const CHAT_MODELS: ChatModelMeta[] = [
  {
    id: "llama3.2:3b",
    label: "Llama 3.2 3B",
    params: "3B",
    context: "128K",
    tagKey: "modelTagFast",
    provider: "ollama",
  },
  {
    id: "mistral:7b",
    label: "Mistral 7B",
    params: "7B",
    context: "32K",
    tagKey: "modelTagCompact",
    provider: "ollama",
  },
  {
    id: "deepseek-r1:7b",
    label: "DeepSeek-R1 7B",
    params: "7B",
    context: "128K",
    tagKey: "modelTagReasoning",
    provider: "ollama",
  },
  {
    id: "gemma3:27b",
    label: "Gemma 3 27B",
    params: "27B",
    context: "128K",
    tagKey: "modelTagBalanced",
    provider: "ollama",
  },
  {
    id: "llama3.3:70b",
    label: "Llama 3.3 70B",
    params: "70B",
    context: "128K",
    tagKey: "modelTagCapable",
    provider: "ollama",
  },
  {
    // OpenAI frontier (routed to the OpenAI backend by the model registry).
    // Gated: visible to all, runnable only by the superadmin (server-enforced).
    id: "gpt-5.5",
    label: "GPT-5.5",
    params: "frontier",
    context: "256K",
    tagKey: "modelTagFrontier",
    provider: "openai",
    gated: true,
  },
];

const FALLBACK: ChatModelMeta = CHAT_MODELS[0] ?? {
  id: "llama3.2:3b",
  label: "Llama 3.2 3B",
  params: "3B",
  context: "128K",
  tagKey: "modelTagFast",
  provider: "ollama",
};

export const DEFAULT_CHAT_MODEL = FALLBACK.id;

/** Resolve a model id to its metadata, falling back to the default. */
export function findModel(id: string | null | undefined): ChatModelMeta {
  return CHAT_MODELS.find((m) => m.id === id) ?? FALLBACK;
}

/** Read the persisted model id (validated), or the default. SSR-safe. */
export function getStoredModel(): string {
  if (typeof window === "undefined") return DEFAULT_CHAT_MODEL;
  const stored = window.localStorage.getItem(CHAT_MODEL_KEY);
  return stored && CHAT_MODELS.some((m) => m.id === stored) ? stored : DEFAULT_CHAT_MODEL;
}

/** Persist the model id and broadcast the change to same-tab listeners. */
export function setStoredModel(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAT_MODEL_KEY, id);
  window.dispatchEvent(new CustomEvent(CHAT_MODEL_EVENT, { detail: id }));
}

/** Hosting descriptor for the Settings card (right of the params badge). */
export function modelHosting(m: ChatModelMeta): string {
  return m.provider === "openai"
    ? `${m.context} ctx · OpenAI API`
    : `${m.context} ctx · on-prem GPU`;
}

/** Short hosting tag for the topbar badge. */
export function modelHostingShort(m: ChatModelMeta): string {
  return m.provider === "openai" ? "frontier" : "on-prem";
}

/** True if the model is gated (paid frontier, superadmin-only). */
export function isGatedModel(id: string | null | undefined): boolean {
  return findModel(id).gated === true;
}

/**
 * Whether a role may *run* a model. Gated models require the superadmin; this
 * is the same predicate the server enforces in the /api/chat proxy.
 */
export function isModelAllowedForRole(
  id: string | null | undefined,
  role: string | null | undefined,
): boolean {
  return isGatedModel(id) ? role === "superadmin" : true;
}
