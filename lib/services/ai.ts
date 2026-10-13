// One place that talks to a language model. Claude is the default. If Claude cannot answer (no key, no
// credit left, rate limit, overloaded, ...) and a Qwen key is set, the same request goes to Qwen
// (Alibaba Cloud's OpenAI-compatible API), so the daily autopilot keeps running.

import Anthropic from "@anthropic-ai/sdk";

export type Provider = "claude" | "qwen";

export interface AiRequest {
  system: string;
  user: string;
  maxTokens: number;
  claudeModel: string;
  adaptiveThinking?: boolean;
}

export interface AiResult {
  text: string;
  provider: Provider;
  fellBackBecause?: string; // why Claude was skipped, when Qwen answered
}

// The fallback model is reached through OpenRouter (one key, many models) or, if that is not set,
// straight through Alibaba Cloud's DashScope. Both speak the same OpenAI-style chat API.
export function qwenConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY || process.env.DASHSCOPE_API_KEY);
}

async function askClaude(req: AiRequest): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic();
  const response = await client.messages.create({
    model: req.claudeModel,
    max_tokens: req.maxTokens,
    ...(req.adaptiveThinking ? { thinking: { type: "adaptive" as const } } : {}),
    system: req.system,
    messages: [{ role: "user", content: req.user }],
  });
  if (response.stop_reason === "refusal") throw new RefusalError("Claude menolak permintaan ini.");
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export class RefusalError extends Error {}

async function askQwen(req: AiRequest): Promise<string> {
  const viaOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const key = process.env.OPENROUTER_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error("Neither OPENROUTER_API_KEY nor DASHSCOPE_API_KEY is set");
  const base = (process.env.QWEN_BASE_URL || (viaOpenRouter ? "https://openrouter.ai/api/v1" : "https://dashscope-intl.aliyuncs.com/compatible-mode/v1")).replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.QWEN_MODEL || (viaOpenRouter ? "qwen/qwen3.7-plus" : "qwen-plus"),
      max_tokens: Math.min(req.maxTokens, 8000),
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string }; message?: string };
  if (!res.ok) throw new Error(`Qwen ${res.status}: ${json.error?.message ?? json.message ?? "request failed"}`);
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Qwen returned an empty answer.");
  return text;
}

export async function aiComplete(req: AiRequest): Promise<AiResult> {
  try {
    return { text: await askClaude(req), provider: "claude" };
  } catch (e) {
    // A refusal is about the request itself, so a second model is not a fix.
    if (e instanceof RefusalError || !qwenConfigured()) throw e;
    const why = (e instanceof Error ? e.message : String(e)).slice(0, 160);
    return { text: await askQwen(req), provider: "qwen", fellBackBecause: why };
  }
}

// Models are told not to fence their JSON, but strip a fence if one appears anyway.
export function parseJsonAnswer<T>(text: string): T {
  const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(json) as T;
}
