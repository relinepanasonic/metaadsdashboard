// Viral Radar service: Collect -> Rank -> Decode, plus the weekly agent that does them on its own.
// Collect uses Instagram's official Business Discovery (free): it reads other public professional accounts'
// Reels with view / like / comment counts. Decode uses Gemini on the video when GEMINI_API_KEY is set, otherwise
// Claude on the cover image + caption.

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/supabase/db";
import { aiComplete } from "./ai";
import { decodeIsUsable, decodePrompt, readDecoded, type DecodeInput, type Decoded } from "@/lib/radar/decode";
import { discoveryErrorMessage, scoreReels, type RawMedia } from "@/lib/radar/rank";

const VERSION = process.env.META_API_VERSION || "v21.0";
const MEDIA_FIELDS = "id,caption,media_product_type,media_type,permalink,timestamp,like_count,comments_count,view_count,thumbnail_url,media_url";
const MAX_VIDEO_BYTES = 18 * 1024 * 1024; // Gemini's inline limit is about 20 MB per request

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// ---------------------------------------------------------------- Collect --------------------------------------------
export async function fetchDiscovery(igUserId: string, handle: string): Promise<{ followers: number | null; media: RawMedia[] }> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN is not set.");
  const params = new URLSearchParams({
    fields: `business_discovery.username(${handle}){username,followers_count,media_count,media.limit(50){${MEDIA_FIELDS}}}`,
    access_token: token,
  });
  const res = await fetch(`https://graph.facebook.com/${VERSION}/${igUserId}?${params}`, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { business_discovery?: { followers_count?: number; media?: { data?: RawMedia[] } }; error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(discoveryErrorMessage(json.error?.message ?? `Instagram ${res.status}`));
  return { followers: json.business_discovery?.followers_count ?? null, media: json.business_discovery?.media?.data ?? [] };
}

export interface CollectResult {
  handle: string;
  reels: number;
  error?: string;
}

export async function collectAccount(accountId: string, onlyWatchId?: string): Promise<CollectResult[]> {
  if (!db) return [];
  const { data: acct } = await db.from("social_accounts").select("id,external_id").eq("id", accountId).maybeSingle();
  if (!acct?.external_id) throw new Error("That Instagram account has no account ID.");
  let q = db.from("radar_watch").select("id,handle").eq("account_id", accountId);
  if (onlyWatchId) q = q.eq("id", onlyWatchId);
  const { data: watch } = await q;
  const out: CollectResult[] = [];

  for (const w of watch ?? []) {
    try {
      const disc = await fetchDiscovery(acct.external_id as string, w.handle as string);
      const scored = scoreReels(disc.media);
      const now = new Date().toISOString();
      const rows = scored.map((r) => ({
        account_id: accountId, watch_id: w.id, handle: w.handle, media_id: r.mediaId, caption: r.caption, permalink: r.permalink,
        thumbnail_url: r.thumbnailUrl, media_url: r.mediaUrl, posted_at: r.postedAt, views: r.views, likes: r.likes, comments: r.comments,
        followers: disc.followers, outlier: r.outlier, score_basis: r.basis, collected_at: now,
      }));
      if (rows.length) await db.from("radar_reels").upsert(rows, { onConflict: "account_id,media_id" });
      await db.from("radar_watch").update({ followers: disc.followers, last_collected_at: now, last_error: null }).eq("id", w.id);
      out.push({ handle: w.handle as string, reels: rows.length });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await db.from("radar_watch").update({ last_error: message.slice(0, 300) }).eq("id", w.id);
      out.push({ handle: w.handle as string, reels: 0, error: message });
    }
  }
  return out;
}

// ---------------------------------------------------------------- Decode ---------------------------------------------
async function askGeminiVideo(video: Buffer, mime: string, prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mime, data: video.toString("base64") } }, { text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4000 },
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${json.error?.message ?? "request failed"}`);
  const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned no text (the video may have been blocked).");
  return text;
}

async function askClaudeVision(image: Buffer, mime: string, prompt: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic();
  const type = (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime) ? mime : "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const r = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2500,
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: type, data: image.toString("base64") } }, { type: "text", text: prompt }] }],
  });
  return r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
}

async function download(url: string, maxBytes: number): Promise<{ bytes: Buffer; mime: string } | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len && len > maxBytes) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > maxBytes) return null;
    return { bytes, mime: (res.headers.get("content-type") ?? "").split(";")[0] || "application/octet-stream" };
  } catch {
    return null;
  }
}

interface ReelRow {
  id: string;
  account_id: string;
  watch_id: string;
  handle: string;
  caption: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  outlier: number | null;
  thumbnail_url: string | null;
  media_url: string | null;
}

export async function decodeReel(reelId: string): Promise<{ ok: boolean; decoded?: Decoded; error?: string }> {
  if (!db) return { ok: false, error: "Database not configured" };
  const load = async () => (await db!.from("radar_reels").select("id,account_id,watch_id,handle,caption,views,likes,comments,outlier,thumbnail_url,media_url").eq("id", reelId).maybeSingle()).data as ReelRow | null;
  let reel = await load();
  if (!reel) return { ok: false, error: "Reel not found." };
  const { data: cfg } = await db.from("radar_accounts").select("niche").eq("account_id", reel.account_id).maybeSingle();
  const input: DecodeInput = { handle: reel.handle, caption: reel.caption ?? "", views: reel.views, likes: reel.likes, comments: reel.comments, outlier: reel.outlier, niche: cfg?.niche };

  let text = "";
  let mode: Decoded["mode"] = "text";
  const notes: string[] = [];

  // DEEP: the model watches the video
  if (geminiConfigured() && reel.media_url) {
    let video = await download(reel.media_url, MAX_VIDEO_BYTES);
    if (!video) {
      // the link Instagram gave at collect time expires: collect this account again for a fresh one, once
      await collectAccount(reel.account_id, reel.watch_id).catch(() => null);
      reel = (await load()) ?? reel;
      if (reel.media_url) video = await download(reel.media_url, MAX_VIDEO_BYTES);
    }
    if (video) {
      try {
        text = await askGeminiVideo(video.bytes, video.mime.startsWith("video/") ? video.mime : "video/mp4", decodePrompt(input, "deep"));
        mode = "deep";
      } catch (e) {
        notes.push(`Deep decode failed (${e instanceof Error ? e.message.slice(0, 120) : e}); used the cover image instead.`);
      }
    } else if (!reel.media_url) {
      notes.push("Instagram gave no video link for this Reel (licensed audio or downloads off); used the cover image instead.");
    }
  }

  // LITE: cover image + caption
  if (!text && reel.thumbnail_url) {
    const img = await download(reel.thumbnail_url, 5 * 1024 * 1024);
    if (img) {
      try {
        text = await askClaudeVision(img.bytes, img.mime, decodePrompt(input, "lite"));
        mode = "lite";
      } catch (e) {
        notes.push(`Image read failed (${e instanceof Error ? e.message.slice(0, 100) : e}).`);
      }
    }
  }

  // TEXT: caption only (Claude, or Qwen if Claude is unavailable)
  if (!text) {
    try {
      const r = await aiComplete({ system: "Kamu analis konten short-form video Instagram Reels berbahasa Indonesia.", user: decodePrompt(input, "text"), maxTokens: 2500, claudeModel: "claude-sonnet-5" });
      text = r.text;
      mode = "text";
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await db.from("radar_reels").update({ decode_error: error.slice(0, 300) }).eq("id", reelId);
      return { ok: false, error };
    }
  }

  const decoded = readDecoded(text, mode);
  if (!decodeIsUsable(decoded)) {
    const error = "The model answered, but not in the expected format. Try again.";
    await db.from("radar_reels").update({ decode_error: error }).eq("id", reelId);
    return { ok: false, error };
  }
  await db.from("radar_reels").update({ decode: decoded, decode_mode: mode, decoded_at: new Date().toISOString(), decode_error: notes.join(" ") || null }).eq("id", reelId);
  return { ok: true, decoded };
}

// ---------------------------------------------------------------- Agent -----------------------------------------------
const BRIEF_SYSTEM = "Kamu strategi konten Instagram Reels berbahasa Indonesia. Kamu menulis ringkasan mingguan singkat dan konkret untuk tim konten.";

export async function writeBrief(accountId: string): Promise<string | null> {
  if (!db) return null;
  const { data: cfg } = await db.from("radar_accounts").select("niche").eq("account_id", accountId).maybeSingle();
  const since = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const { data: reels } = await db
    .from("radar_reels")
    .select("id,handle,caption,views,outlier,decode")
    .eq("account_id", accountId)
    .not("decode", "is", null)
    .gte("posted_at", since)
    .order("outlier", { ascending: false, nullsFirst: false })
    .limit(8);
  if (!reels?.length) return null;

  const list = reels
    .map((r, i) => {
      const d = r.decode as Decoded;
      return `${i + 1}. @${r.handle} (${r.outlier ?? "?"}x, ${r.views ?? "?"} views)\n   Rumus: ${d.hookType}\n   3 detik pertama: ${d.firstThreeSeconds}\n   Struktur: ${d.structure}\n   Pola: ${d.pattern}`;
    })
    .join("\n");
  const answer = await aiComplete({
    system: BRIEF_SYSTEM,
    user: `Niche akun kami: ${cfg?.niche || "(belum diisi)"}\n\nReel pemenang terbaru di niche ini (sudah dibongkar):\n${list}\n\nTulis ringkasan mingguan dengan format:\nYANG SEDANG BERHASIL: 3 rumus utama, satu kalimat tiap rumus.\n3 IDE UNTUK KITA: judul, hook, dan alasannya.\nHINDARI: apa yang terlihat sudah jenuh.\nSingkat, konkret, tanpa basa-basi.`,
    maxTokens: 1500,
    claudeModel: "claude-sonnet-5",
  });
  await db.from("radar_briefs").insert({ account_id: accountId, summary: answer.text, reel_ids: reels.map((r) => r.id), provider: answer.provider });
  return answer.text;
}

export interface AgentReport {
  account: string;
  collected: number;
  decoded: number;
  brief: boolean;
  errors: string[];
}

// The weekly agent. For every account with "auto" on and a watchlist: collect, decode the best new winners, write
// the brief. A time budget keeps it inside the cron's limit; accounts it did not reach go first next run.
export async function runRadarAgent(opts: { budgetMs?: number; maxDecodesPerAccount?: number; accountId?: string; force?: boolean } = {}): Promise<AgentReport[]> {
  if (!db) return [];
  const started = Date.now();
  const budget = opts.budgetMs ?? 240_000;
  const maxDecodes = opts.maxDecodesPerAccount ?? 4;
  const reports: AgentReport[] = [];

  let q = db.from("radar_accounts").select("account_id,last_run_at").eq("auto", true);
  if (opts.accountId) q = db.from("radar_accounts").select("account_id,last_run_at").eq("account_id", opts.accountId);
  const { data: due } = await q;
  const weekAgo = Date.now() - 6.5 * 86_400_000;
  const todo = (due ?? [])
    .filter((a) => opts.force || opts.accountId || !a.last_run_at || Date.parse(a.last_run_at as string) < weekAgo)
    .sort((a, b) => Date.parse((a.last_run_at as string) ?? "1970-01-01") - Date.parse((b.last_run_at as string) ?? "1970-01-01"));

  for (const a of todo) {
    if (Date.now() - started > budget) break;
    const id = a.account_id as string;
    const { data: sa } = await db.from("social_accounts").select("handle").eq("id", id).maybeSingle();
    const report: AgentReport = { account: (sa?.handle as string) ?? id, collected: 0, decoded: 0, brief: false, errors: [] };
    try {
      const results = await collectAccount(id);
      report.collected = results.reduce((n, r) => n + r.reels, 0);
      report.errors.push(...results.filter((r) => r.error).map((r) => `@${r.handle}: ${r.error}`));

      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data: top } = await db
        .from("radar_reels")
        .select("id")
        .eq("account_id", id)
        .is("decode", null)
        .gte("outlier", 2)
        .gte("posted_at", since)
        .order("outlier", { ascending: false })
        .limit(maxDecodes);
      for (const r of top ?? []) {
        if (Date.now() - started > budget) break;
        const d = await decodeReel(r.id as string);
        if (d.ok) report.decoded++;
        else if (d.error) report.errors.push(d.error);
      }
      report.brief = Boolean(await writeBrief(id));
      await db.from("radar_accounts").update({ last_run_at: new Date().toISOString(), last_status: `collected ${report.collected}, decoded ${report.decoded}${report.errors.length ? `, ${report.errors.length} problem(s)` : ""}` }).eq("account_id", id);
    } catch (e) {
      report.errors.push(e instanceof Error ? e.message : String(e));
      await db.from("radar_accounts").update({ last_status: `failed: ${report.errors[0]}`.slice(0, 300) }).eq("account_id", id);
    }
    reports.push(report);
  }
  return reports;
}
