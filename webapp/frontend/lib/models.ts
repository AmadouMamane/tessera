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
  /** Ollama model id sent to the backend (TESSERA_OLLAMA_CHAT_MODEL). */
  id: string;
  /** Human-readable display name. */
  label: string;
  /** Parameter count, e.g. "70B". */
  params: string;
  /** Context window, e.g. "128K". */
  context: string;
  /** i18n key for the one-line characterisation shown on the Settings card. */
  tagKey: string;
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
  },
  {
    id: "mistral:7b",
    label: "Mistral 7B",
    params: "7B",
    context: "32K",
    tagKey: "modelTagCompact",
  },
  {
    id: "deepseek-r1:7b",
    label: "DeepSeek-R1 7B",
    params: "7B",
    context: "128K",
    tagKey: "modelTagReasoning",
  },
  {
    id: "gemma3:27b",
    label: "Gemma 3 27B",
    params: "27B",
    context: "128K",
    tagKey: "modelTagBalanced",
  },
  {
    id: "llama3.3:70b",
    label: "Llama 3.3 70B",
    params: "70B",
    context: "128K",
    tagKey: "modelTagCapable",
  },
  {
    // OpenAI frontier (routed to the OpenAI backend by the model registry).
    id: "gpt-5.5",
    label: "GPT-5.5",
    params: "frontier",
    context: "—",
    tagKey: "modelTagCapable",
  },
];

const FALLBACK: ChatModelMeta = CHAT_MODELS[0] ?? {
  id: "llama3.2:3b",
  label: "Llama 3.2 3B",
  params: "3B",
  context: "128K",
  tagKey: "modelTagFast",
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
