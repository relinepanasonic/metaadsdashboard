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
  truncated?: boolean; // the model hit its length limit, so the answer is cut off
  fellBackBecause?: string; // why Claude was skipped, when Qwen answered
}

// The fallback model is reached through OpenRouter (one key, many models) or, if that is not set,
// straight through Alibaba Cloud's DashScope. Both speak the same OpenAI-style chat API.
export function qwenConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY || process.env.DASHSCOPE_API_KEY);
}

async function askClaude(req: AiRequest): Promise<{ text: string; truncated: boolean }> {
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
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { text, truncated: response.stop_reason === "max_tokens" };
}

export class RefusalError extends Error {}

async function askQwen(req: AiRequest): Promise<{ text: string; truncated: boolean }> {
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
  const json = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string }; finish_reason?: string }[]; error?: { message?: string }; message?: string };
  if (!res.ok) throw new Error(`Qwen ${res.status}: ${json.error?.message ?? json.message ?? "request failed"}`);
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Qwen returned an empty answer.");
  return { text, truncated: json.choices?.[0]?.finish_reason === "length" };
}

export async function aiComplete(req: AiRequest): Promise<AiResult> {
  try {
    const a = await askClaude(req);
    return { text: a.text, provider: "claude", truncated: a.truncated };
  } catch (e) {
    // A refusal is about the request itself, so a second model is not a fix.
    if (e instanceof RefusalError || !qwenConfigured()) throw e;
    const why = (e instanceof Error ? e.message : String(e)).slice(0, 160);
    const a = await askQwen(req);
    return { text: a.text, provider: "qwen", fellBackBecause: why, truncated: a.truncated };
  }
}

// Models are told to answer with bare JSON, but in practice they may add a fence or a sentence around it, or
// put real line breaks inside a long HTML string (which JSON forbids). Read all of those.
export function parseJsonAnswer<T>(text: string): T {
  let t = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  try {
    return JSON.parse(t) as T;
  } catch {
    return JSON.parse(escapeControlCharsInStrings(t)) as T;
  }
}

const NEWLINE = String.fromCharCode(10);
const RETURN = String.fromCharCode(13);
const TAB = String.fromCharCode(9);

function escapeControlCharsInStrings(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (inString) {
      if (escaped) { out += ch; escaped = false; continue; }
      if (ch === "\\") { out += ch; escaped = true; continue; }
      if (ch === '"') { inString = false; out += ch; continue; }
      if (ch === NEWLINE) { out += "\\n"; continue; }
      if (ch === RETURN) { out += "\\r"; continue; }
      if (ch === TAB) { out += "\\t"; continue; }
      out += ch;
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out;
}

// A long article does not survive being wrapped in JSON: one plain quote character inside the text breaks it.
// So drafts are asked for as labelled sections instead:  ===TITLE=== (text) ===BODY=== (text) ...
export function parseSections(text: string, names: string[]): Record<string, string> | null {
  const out: Record<string, string> = {};
  const marker = /^===([A-Z_]+)===[ \t]*$/gm;
  const hits: { name: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = marker.exec(text))) hits.push({ name: m[1], start: m.index, end: m.index + m[0].length });
  for (let i = 0; i < hits.length; i++) {
    const to = i + 1 < hits.length ? hits[i + 1].start : text.length;
    out[hits[i].name] = text.slice(hits[i].end, to).trim();
  }
  return names.every((n) => out[n]) ? out : null;
}

// A short post: the model should answer with the bare text, but it may still wrap it in a fence, quotes, or JSON.
export function cleanPostText(answer: string): string {
  let t = answer.trim().replace(/^```(?:\w+)?\s*/, "").replace(/\s*```$/, "").trim();
  const wrapped = t.match(/^\{\s*"text"\s*:\s*"([\s\S]*)"\s*\}$/);
  if (wrapped) t = wrapped[1].replace(/\\n/g, String.fromCharCode(10)).replace(/\\"/g, '"');
  const quote = /["\u201c\u201d]/;
  if (t.length > 1 && quote.test(t[0]) && quote.test(t[t.length - 1]) && !quote.test(t.slice(1, -1))) t = t.slice(1, -1);
  return t.trim();
}
