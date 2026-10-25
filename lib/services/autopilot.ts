// The daily autopilot. Runs from the daily cron (09:00 WIB) and from "Run now" in Blog Engine → Autopilot.
//
//  blog:     takes the next keyword from the site's keyword list, writes the article, and publishes it.
//  threads:  writes one Threads post in the style of the samples you gave, and schedules it for
//            the chosen time (18:00 WIB by default). Make's check-in then publishes it, as for any scheduled post.

import { db } from "@/lib/supabase/db";
import { FIRSTHAND_MARKER, isValidModelId, type ModelId } from "@/lib/seo/constants";
import { draftPost } from "./contentWriter";
import { aiComplete, cleanPostText } from "./ai";
import { publishSavedKeyword } from "./publishKeyword";
import { cleanTopic } from "./threads";

export interface AutopilotSetting {
  key: string;
  kind: "blog" | "threads";
  client_id: string | null;
  site_id: string | null;
  handle: string | null;
  enabled: boolean;
  time_wib: string;
  topic: string | null;
  samples: string | null;
  instructions: string | null;
  model: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_message: string | null;
}

export interface RunResult {
  ok: boolean;
  message: string;
  url?: string;
  text?: string; // preview of a Threads post
}

const WIB_MS = 7 * 3600_000;
const MIN_WORDS = 500;
const AUTOPILOT_BLOG_MODEL: ModelId = "claude-sonnet-5"; // fits the cron's time limit; Opus can run long

// Start of today (00:00) in WIB, as a UTC instant.
function wibDayStart(now: Date): number {
  const shifted = new Date(now.getTime() + WIB_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - WIB_MS;
}

function plainWords(html: string): number {
  return html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
}

// ---- blog -------------------------------------------------------------------------------------------
export async function runBlog(s: AutopilotSetting, opts: { preview?: boolean } = {}): Promise<RunResult> {
  if (!db || !s.site_id) return { ok: false, message: "No website selected." };

  const { data: next } = await db
    .from("saved_keywords")
    .select("id,keyword")
    .eq("site_id", s.site_id)
    .eq("status", "idea")
    .order("volume", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!next) return { ok: false, message: "The keyword list for this website has no unused keywords left. Save more in Research → Keywords." };

  const model = s.model && isValidModelId(s.model) ? s.model : AUTOPILOT_BLOG_MODEL;
  const draft = await draftPost(next.keyword, model, { autopilot: true });
  const by = draft.provider === "qwen" ? ` (written by Qwen because Claude was unavailable: ${draft.fellBackBecause ?? "error"})` : "";

  const { error: saveErr } = await db
    .from("saved_keywords")
    .update({ status: "drafted", draft_title: draft.title, draft_slug: draft.slug, draft_meta: draft.metaDescription, draft_excerpt: draft.excerpt, draft_html: draft.bodyHtml, draft_tag: draft.tag })
    .eq("id", next.id);
  if (saveErr) return { ok: false, message: saveErr.message };

  // A draft that is too short or still carries the placeholder is kept for a person instead of being published.
  const words = plainWords(draft.bodyHtml);
  if (words < MIN_WORDS || draft.bodyHtml.includes(FIRSTHAND_MARKER)) {
    return { ok: false, message: `Drafted "${draft.title}" but not published: only ${words} words (needs ${MIN_WORDS}) or it still has a placeholder. Review it in Content Engine.${by}` };
  }
  if (opts.preview) return { ok: true, message: `Drafted "${draft.title}" (${words} words). Not published — open it in Content Engine.${by}` };

  const { url } = await publishSavedKeyword(next.id, { trigger: "auto" });
  return { ok: true, message: `Published "${draft.title}" (${words} words).${by}`, url };
}

// ---- Threads -----------------------------------------------------------------------------------------
const THREADS_SYSTEM = `Kamu menulis satu postingan Threads dalam Bahasa Indonesia, dari sudut pandang seorang seller Shopee, untuk sebuah brand.

POLA POSTINGAN YANG TERBUKTI JALAN (ikuti urutannya):
1. HOOK satu baris yang bikin orang berhenti scroll: momen relatable atau kejutan yang dialami seller. Contoh pola: "Pernah nggak, buka Seller Centre pagi-pagi eh orderan udah numpuk, padahal nggak pasang iklan?" atau "Toko sepi berminggu-minggu, tiba-tiba ramai sendiri. Kok bisa?"
2. ISI 2-4 kalimat pendek, satu ide, tiap kalimat boleh di baris sendiri. Ceritakan kejadian atau insight dengan bahasa ngobrol (aku, kamu, nggak, banget, ya). Jelaskan KENAPA itu terjadi atau apa yang bisa dilakukan seller.
3. PENUTUP yang mengajak orang membalas: pertanyaan langsung ke seller ("Temen-temen seller, ada yang pernah ngalamin gini juga nggak?") ATAU ajakan komentar ("Komen 'AUDIT' kalau mau Prof bantu cek tokomu, gratis"). Pilih salah satu, jangan keduanya.

ATURAN:
- Maksimal 480 karakter. Paragraf pendek, beri baris kosong antar bagian.
- JANGAN mengarang angka spesifik, persentase, nominal rupiah, hasil penjualan, studi kasus, testimoni, atau nama klien. Pakai kata seperti "tiba-tiba ramai", "notifikasi bunyi terus", "orderan numpuk".
- Boleh memakai "aku" untuk momen umum yang relatable, tapi jangan mengklaim hasil nyata tertentu.
- Tanpa hashtag (topik Threads diatur terpisah). Emoji paling banyak 2, jangan di setiap kalimat.
- Jangan terdengar seperti iklan atau artikel. Tidak ada tanda seru berlebihan, tidak ada jargon kaku.
- Tiru GAYA dan struktur contoh yang diberikan, tapi jangan menyalin kalimatnya dan jangan mengulang topik postingan sebelumnya.

Balas HANYA dengan isi postingan itu sendiri: tanpa JSON, tanpa tanda kutip pembungkus, tanpa judul atau penjelasan.`;

// The topic field can hold two tags ("Business Threads | Seller Shopee"); they take turns every other day so the feed does not get stale.
export function pickTopic(raw: string | null | undefined, dayStartMs: number): string | null {
  const list = String(raw ?? "").split("|").map((t) => cleanTopic(t)).filter((t): t is string => Boolean(t));
  if (!list.length) return null;
  const day = Math.floor((dayStartMs + WIB_MS) / 86_400_000);
  return list[(day + 1) % list.length];
}

const TOPIC_ANGLES: [RegExp, string][] = [
  [/shopee|seller/i, "pengalaman dan tips seller Shopee: orderan, iklan, algoritma, chat, rating, stok, voucher, dan kebiasaan seller sehari-hari"],
  [/business|bisnis/i, "dunia bisnis dan jualan online secara umum: mindset pemilik usaha, omzet naik turun, keputusan yang sering salah, dan pelajaran dari menjalankan toko"],
];

export async function runThreads(s: AutopilotSetting, opts: { preview?: boolean; now?: boolean } = {}): Promise<RunResult> {
  if (!db || !s.client_id || !s.handle) return { ok: false, message: "No Threads account selected." };
  const now = new Date();

  const { data: profile } = await db
    .from("publish_profiles")
    .select("id,external_id,token_expires_at")
    .eq("platform", "threads")
    .eq("client_id", s.client_id)
    .eq("handle", s.handle)
    .maybeSingle();
  if (!profile?.token_expires_at) return { ok: false, message: `${s.handle} is not connected to Threads yet — connect it on the Clients page.` };

  // Once a day only (a forced run, from the button, is always allowed).
  const dayStart = wibDayStart(now);
  if (!opts.preview && !opts.now) {
    const { data: today } = await db
      .from("scheduled_posts")
      .select("id")
      .eq("created_by", "autopilot")
      .eq("client_id", s.client_id)
      .gte("scheduled_at", new Date(dayStart).toISOString())
      .lt("scheduled_at", new Date(dayStart + 24 * 3600_000).toISOString())
      .limit(1);
    if (today?.length) return { ok: true, message: "Today's Threads post is already scheduled." };
  }

  // Today's tag, and what to write about: that tag's theme (the two tags take turns), nudged by the latest blog topic.
  const todayTopic = pickTopic(s.topic, dayStart);
  const angle = TOPIC_ANGLES.find(([re]) => todayTopic && re.test(todayTopic))?.[1] ?? "tips praktis untuk pemilik bisnis dan seller online";
  let blogHint = "";
  const { data: sites } = await db.from("search_console_sites").select("id").eq("client_id", s.client_id);
  if (sites?.length) {
    const { data: kw } = await db
      .from("saved_keywords")
      .select("keyword,draft_title")
      .in("site_id", sites.map((x) => x.id))
      .in("status", ["published", "drafted", "idea"])
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (kw) blogHint = kw.draft_title || kw.keyword;
  }

  const { data: recent } = await db
    .from("scheduled_posts")
    .select("caption")
    .eq("created_by", "autopilot")
    .eq("client_id", s.client_id)
    .order("scheduled_at", { ascending: false })
    .limit(8);

  const user =
    `Brand: ${s.handle}\nTopik hari ini: ${angle}\n` +
    (s.instructions?.trim() ? `\nInstruksi tambahan:\n${s.instructions.trim()}\n` : "") +
    (s.samples?.trim() ? `\nContoh postingan Threads yang berhasil (tiru pola hook, isi, dan penutupnya):\n${s.samples.trim()}\n` : "") +
    (recent?.length ? `\nPostingan sebelumnya (jangan ulangi topiknya):\n${recent.map((r) => `- ${String(r.caption).slice(0, 120)}`).join("\n")}\n` : "");

  const answer = await aiComplete({ system: THREADS_SYSTEM, user, maxTokens: 800, claudeModel: "claude-sonnet-5" });
  let text = cleanPostText(answer.text);
  if (!text) return { ok: false, message: "The model returned no text." };
  if (text.length > 500) text = text.slice(0, 497).replace(/\s+\S*$/, "") + "…";
  const by = answer.provider === "qwen" ? ` (written by Qwen because Claude was unavailable: ${answer.fellBackBecause ?? "error"})` : "";

  if (opts.preview) return { ok: true, message: `Preview${by}`, text };

  // Today at the chosen time (WIB); if that has passed, or on "post now", two minutes from now.
  const [hh, mm] = (s.time_wib || "18:00").split(":").map((n) => Number(n) || 0);
  let when = dayStart + hh * 3600_000 + mm * 60_000;
  if (opts.now || when < now.getTime() + 60_000) when = now.getTime() + 2 * 60_000;

  const { data: post, error } = await db
    .from("scheduled_posts")
    .insert({ client_id: s.client_id, caption: text, content_type: "text", media: [], scheduled_at: new Date(when).toISOString(), status: "scheduled", created_by: "autopilot", ...(todayTopic ? { topic: todayTopic } : {}) })
    .select("id")
    .single();
  if (error || !post) return { ok: false, message: error?.message ?? "Could not schedule the post." };
  const { error: tErr } = await db.from("scheduled_post_targets").insert({ post_id: post.id, platform: "threads", handle: s.handle, external_id: profile.external_id });
  if (tErr) {
    await db.from("scheduled_posts").delete().eq("id", post.id);
    return { ok: false, message: tErr.message };
  }
  return { ok: true, message: `Scheduled for ${new Date(when + WIB_MS).toISOString().slice(0, 16).replace("T", " ")} WIB.${by}`, text };
}

// ---- driver --------------------------------------------------------------------------------------------
export async function runSetting(s: AutopilotSetting, opts: { preview?: boolean; now?: boolean } = {}): Promise<RunResult> {
  let result: RunResult;
  try {
    result = s.kind === "blog" ? await runBlog(s, { preview: opts.preview }) : await runThreads(s, opts);
  } catch (e) {
    result = { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
  if (db && !opts.preview) {
    await db
      .from("autopilot_settings")
      .update({ last_run_at: new Date().toISOString(), last_status: result.ok ? "ok" : "failed", last_message: result.message.slice(0, 500), updated_at: new Date().toISOString() })
      .eq("key", s.key);
  }
  return result;
}

// The daily cron: every enabled setting, one after the other, each isolated from the others' failures.
export async function runAllAutopilots(): Promise<{ key: string; ok: boolean; message: string }[]> {
  if (!db) return [];
  const { data } = await db.from("autopilot_settings").select("*").eq("enabled", true);
  const out: { key: string; ok: boolean; message: string }[] = [];
  // Threads first: it is quick, and the blog can take minutes.
  const ordered = ((data ?? []) as AutopilotSetting[]).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "threads" ? -1 : 1));
  for (const s of ordered) {
    out.push({ key: s.key, ...(await runSetting(s)) });
  }
  return out;
}
