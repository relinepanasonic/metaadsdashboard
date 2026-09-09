// Publishing is blocked while this marker is still in a draft body. It is the
// mechanical guarantee that no post ships as pure AI output.
export const FIRSTHAND_MARKER = "[ISI PENGALAMAN ANDA DI SINI";

// Models available for drafting in the Content Engine. `adaptiveThinking`
// tells contentWriter.ts whether that model accepts { type: "adaptive" }
// thinking — older/smaller models don't, so it's omitted for those.
export const MODEL_OPTIONS = [
  { id: "claude-opus-5", label: "Opus 5 — best quality", adaptiveThinking: true },
  { id: "claude-sonnet-5", label: "Sonnet 5 — balanced", adaptiveThinking: true },
  { id: "claude-fable-5-1", label: "Fable 5.1 — creative writing", adaptiveThinking: true },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 — fastest & cheapest", adaptiveThinking: false },
] as const;

export type ModelId = (typeof MODEL_OPTIONS)[number]["id"];
export const DEFAULT_MODEL: ModelId = "claude-opus-5";

export function isValidModelId(id: string): id is ModelId {
  return MODEL_OPTIONS.some((m) => m.id === id);
}
