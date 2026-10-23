// Re-Engine writer. Takes one successful post, reads its hook formula and structure, and writes new contents
// in the same formula for Google Flow. Two steps, so the ideas differ from each other:
//   1. PLAN   one call: analyse the source + propose N different briefs (title, format, products, guest, outfit)
//   2. WRITE  one call per brief, in parallel: hook / problem / solution / CTA, 4 frames, timing, dialogue, overlays, caption
// The final prompts are then assembled from the Series Bible (lib/reengine/assemble.ts), not written by the AI.

import { aiComplete, type Provider } from "./ai";
import { assembleImagePrompt, assembleVideoPrompt, countDialogueWords, pick, type PromptParts } from "@/lib/reengine/assemble";
import { firstOf, listKeys, parseKeyValues, parseMarked } from "@/lib/reengine/parse";
import type { ContentBrief, ContentItem, SeriesBible, SourceAnalysis, SourcePost } from "@/lib/reengine/types";

export const MIN_WORDS = 95;
export const MAX_WORDS = 140;
const DEFAULT_MODEL = "claude-sonnet-5";

export interface GenerateOptions {
  bible: SeriesBible;
  source: SourcePost;
  count: number; // 1..5
  direction?: string;
  formatHint?: string;
  productKeys?: string[]; // limit to these (empty = the AI chooses)
  guestKeys?: string[];
  model?: string;
}

export interface GenerateResult {
  analysis: SourceAnalysis;
  items: ContentItem[];
  provider: Provider;
  fellBackBecause?: string;
  warnings: string[];
}

// ---- prompts -------------------------------------------------------------------------------------------------------
function systemPrompt(b: SeriesBible): string {
  const usable = b.products.filter((p) => p.usable);
  const blocked = b.products.filter((p) => !p.usable);
  return `Kamu penulis konten untuk seri "${b.seriesName}". Host: ${b.hostName}. Tagline: "${b.taglines.main}". Sign-off wajib di akhir setiap video: "${b.taglines.signoff}"

TUGAS: dari satu konten yang SUKSES, ambil rumus hook dan struktur-nya, lalu buat konten BARU dengan rumus yang sama tetapi situasi, produk, tokoh, dan ide yang berbeda. Jangan menyalin kalimat konten sumber.

ATURAN SERI (wajib dipatuhi):
${b.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

PRODUK YANG BOLEH DIPAKAI. Hanya fakta pada "klaim" yang boleh diucapkan; selebihnya hanya fungsi umum tanpa angka atau janji:
${usable.map((p) => `- ${p.key} | ${p.name} | klaim: ${p.claims || "(belum ada data terverifikasi, hindari kecuali diminta)"}${p.note ? ` | catatan: ${p.note}` : ""}`).join("\n")}
${blocked.length ? `\nPRODUK TIDAK BOLEH DIPAKAI ATAU DISEBUT: ${blocked.map((p) => `${p.key} (${p.name.slice(0, 60)})`).join("; ")}` : ""}

TOKOH TAMU (maksimal 3 dalam satu konten; kosong jika host sendiri):
${b.guests.map((g) => `- ${g.key} | ${g.name} | ${g.role} | ${g.profile.slice(0, 110)}`).join("\n")}

OUTFIT HOST (pilih satu key yang cocok dengan situasi):
${b.outfits.map((o) => `- ${o.key} | ${o.label}`).join("\n")}

Semua adegan terjadi di ${b.location.slice(0, 60)}… (lokasi tetap, tidak ada lokasi lain). Tulis dalam Bahasa Indonesia yang natural, hangat, tidak hard-sell.`;
}

function sourceText(s: SourcePost): string {
  const m = s.metrics ?? {};
  const v = s.verdicts ?? {};
  const nums = [
    m.views != null ? `views ${m.views}` : "", m.reach != null ? `reach ${m.reach}` : "", m.likes != null ? `likes ${m.likes}` : "", m.comments != null ? `komentar ${m.comments}` : "",
    m.saves != null ? `disimpan ${m.saves}` : "", m.shares != null ? `dibagikan ${m.shares}` : "", m.avgWatchSec != null ? `rata-rata tonton ${m.avgWatchSec.toFixed(1)}s` : "", m.skipRate != null ? `${m.skipRate.toFixed(0)}% pergi dalam 3 detik` : "",
  ].filter(Boolean).join(", ");
  return [
    s.account ? `Akun: ${s.account}` : "",
    `Caption:\n${s.caption}`,
    s.script?.trim() ? `Skrip / prompt asli:\n${s.script.trim()}` : "(skrip asli tidak diberikan: simpulkan struktur dari caption)",
    nums ? `Angka: ${nums}` : "",
    v.hook || v.value || v.cta ? `Penilaian otomatis: Hook ${v.hook ?? "-"}${v.hookWhy ? ` (${v.hookWhy})` : ""}; Value ${v.value ?? "-"}${v.valueWhy ? ` (${v.valueWhy})` : ""}; CTA ${v.cta ?? "-"}${v.ctaWhy ? ` (${v.ctaWhy})` : ""}` : "",
  ].filter(Boolean).join("\n");
}

function planPrompt(o: GenerateOptions): string {
  const b = o.bible;
  const only = (o.productKeys ?? []).length ? `Produk yang HARUS dipilih dari daftar ini: ${o.productKeys!.join(", ")}.` : "Pilih produk yang paling cocok dari daftar yang boleh dipakai; variasikan produk antar ide.";
  const guests = (o.guestKeys ?? []).length ? `Tokoh tamu yang boleh dipakai: ${o.guestKeys!.join(", ")}.` : "Variasikan tokoh tamu antar ide (boleh tanpa tamu).";
  return `KONTEN SUKSES (sumber):
${sourceText(o.source)}

PERMINTAAN: analisis konten sukses itu, lalu rencanakan ${o.count} ide konten BARU yang berbeda satu sama lain.
${only}
${guests}
${o.formatHint ? `Format yang diinginkan: ${o.formatHint}` : "Format: REELS (sesuaikan jenisnya, mis. Tamu Dadakan, Mitos vs Fakta, Game, Tutorial Santai, Komedi Generasi)."}
${o.direction?.trim() ? `Arahan tambahan: ${o.direction.trim()}` : ""}

Balas HANYA dengan penanda berikut (setiap penanda di barisnya sendiri), tanpa JSON dan tanpa komentar lain:
[[FORMULA]]
nama singkat rumus hook sumber
[[PATTERN]]
pola hook yang bisa dipakai ulang, dengan bagian kosong, mis. "Tamu bilang ___ ; dulu aku ___, sekarang aku ___"
[[STRUCTURE]]
urutan beat konten sumber: Hook → Problem → Solution (+RTB) → CTA, satu kalimat per beat
[[WHY]]
mengapa berhasil, kaitkan dengan angka yang diberikan
[[KEEP]]
apa yang harus dipertahankan persis
[[VARY]]
apa yang diganti agar konten terasa baru
${Array.from({ length: o.count }, () => `[[BRIEF]]
FORMAT: REELS · nama format
TITLE: judul konten
ANGLE: satu kalimat: apa yang membedakan ide ini
PRODUCTS: key, key
GUESTS: key (atau none)
OUTFIT: key`).join("\n")}`;
}

function writePrompt(o: GenerateOptions, analysis: SourceAnalysis, brief: ContentBrief, feedback?: string): string {
  const b = o.bible;
  const products = pick(b.products, brief.productKeys);
  const guests = pick(b.guests, brief.guestKeys);
  return `RUMUS DARI KONTEN SUKSES:
Rumus: ${analysis.formula}
Pola hook: ${analysis.pattern}
Struktur: ${analysis.structure}
Pertahankan: ${analysis.keep}
Ganti: ${analysis.vary}

BRIEF KONTEN BARU:
Format: ${brief.format}
Judul: ${brief.title}
Beda dari ide lain: ${brief.angle}
Produk: ${products.map((p) => `${p.name} (klaim yang boleh diucapkan: ${p.claims || "tidak ada, hanya fungsi umum"})`).join("; ") || "(pilih dari daftar)"}
Tokoh tamu: ${guests.map((g) => `${g.name} (${g.role})`).join("; ") || "tidak ada, host sendiri"}
${o.direction?.trim() ? `Arahan tambahan: ${o.direction.trim()}` : ""}

CONTOH KONTEN JADI (format dan kualitas yang diharapkan; konten barumu harus berbeda isinya):
${b.example}

TULIS KONTEN BARU. Syarat:
- Dialog total ${MIN_WORDS + 5}-${MAX_WORDS - 15} kata, mengalir satu napas, tempo tenang; setiap baris berformat: Nama (aksi singkat): "ucapan". Hanya satu pembicara per baris.
- ${b.hostName} menyebut nama produk Panasonic yang tampil; nama itu ditulis di [[SPOKEN_NAMES]] dan benar-benar diucapkan di dialog.
- Baris dialog TERAKHIR: ${b.hostName} (menatap kamera, menutup video): "${b.taglines.signoff}"
- Klaim produk hanya dari "klaim yang boleh diucapkan". Tanpa angka atau janji yang tidak ada di klaim.
- 4 FRAME untuk storyboard (HOOK, PROBLEM, RTB, CTA + TAGLINE) dan 4 TIMING (0-10s, 10-20s, 20-30s, 30-40s).
- 4 OVERLAY teks pendek (ditambahkan saat editing). CAPTION: kalimat pembuka, 1-2 kalimat manfaat, ajakan CTA, lalu hashtag.
${feedback ? `\nPERBAIKI MASALAH BERIKUT dari percobaan sebelumnya, lalu tulis ulang LENGKAP: ${feedback}` : ""}

Balas HANYA dengan penanda ini, masing-masing di barisnya sendiri (tanpa JSON): [[HOOK]] [[PROBLEM]] [[SOLUTION]] [[CTA]] [[FRAME1]] [[FRAME2]] [[FRAME3]] [[FRAME4]] [[TIMING1]] [[TIMING2]] [[TIMING3]] [[TIMING4]] [[SPOKEN_NAMES]] [[DIALOGUE]] [[OVERLAY1]] [[OVERLAY2]] [[OVERLAY3]] [[OVERLAY4]] [[CAPTION]]`;
}

// ---- reading + checking answers ------------------------------------------------------------------------------------
export function readPlan(text: string, bible: SeriesBible, count: number): { analysis: SourceAnalysis; briefs: ContentBrief[] } {
  const sec = parseMarked(text);
  const analysis: SourceAnalysis = {
    formula: firstOf(sec, "FORMULA"),
    pattern: firstOf(sec, "PATTERN"),
    structure: firstOf(sec, "STRUCTURE"),
    why: firstOf(sec, "WHY"),
    keep: firstOf(sec, "KEEP"),
    vary: firstOf(sec, "VARY"),
  };
  const outfitKeys = bible.outfits.map((o) => o.key);
  const briefs: ContentBrief[] = sec
    .filter((s) => s.name === "BRIEF")
    .map((s) => {
      const kv = parseKeyValues(s.body);
      const products = listKeys(kv.PRODUCTS).filter((k) => bible.products.some((p) => p.key === k && p.usable));
      const guests = listKeys(kv.GUESTS).filter((k) => bible.guests.some((g) => g.key === k)).slice(0, 3);
      const outfit = (kv.OUTFIT ?? "").trim().toLowerCase();
      return {
        format: kv.FORMAT || "REELS",
        title: kv.TITLE || "Tanpa judul",
        angle: kv.ANGLE || "",
        productKeys: products,
        guestKeys: guests,
        outfitKey: outfitKeys.includes(outfit) ? outfit : "home_tshirt",
      };
    })
    .slice(0, count);
  return { analysis, briefs };
}

export interface Written {
  hook: string; problem: string; solution: string; cta: string;
  frames: string[]; timing: string[]; spokenNames: string; dialogue: string[]; overlay: string[]; caption: string;
}

export function readWritten(text: string): Written {
  const sec = parseMarked(text);
  const n = (base: string) => [1, 2, 3, 4].map((i) => firstOf(sec, `${base}${i}`));
  return {
    hook: firstOf(sec, "HOOK"), problem: firstOf(sec, "PROBLEM"), solution: firstOf(sec, "SOLUTION"), cta: firstOf(sec, "CTA"),
    frames: n("FRAME"), timing: n("TIMING"), spokenNames: firstOf(sec, "SPOKEN_NAMES"),
    dialogue: firstOf(sec, "DIALOGUE").split("\n").map((l) => l.trim()).filter(Boolean), overlay: n("OVERLAY"), caption: firstOf(sec, "CAPTION"),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();

// hard = must be fixed (the write is retried); soft = shown to the person as a warning
export function checkWritten(w: Written, bible: SeriesBible): { hard: string[]; soft: string[]; words: number } {
  const hard: string[] = [];
  const soft: string[] = [];
  const missing = (["hook", "problem", "solution", "cta", "spokenNames", "caption"] as const).filter((k) => !w[k]);
  if (missing.length) hard.push(`bagian kosong: ${missing.join(", ")}`);
  if (w.frames.some((f) => !f)) hard.push("FRAME 1-4 harus semuanya terisi");
  if (w.timing.some((f) => !f)) hard.push("TIMING 1-4 harus semuanya terisi");
  if (w.overlay.some((f) => !f)) hard.push("OVERLAY 1-4 harus semuanya terisi");
  if (w.dialogue.length < 4) hard.push("dialog minimal 4 baris");

  const words = countDialogueWords(w.dialogue);
  if (words < MIN_WORDS) hard.push(`dialog hanya ${words} kata, butuh ${MIN_WORDS}-${MAX_WORDS}`);
  if (words > MAX_WORDS) hard.push(`dialog ${words} kata, terlalu panjang; maksimal ${MAX_WORDS}`);

  const last = w.dialogue[w.dialogue.length - 1] ?? "";
  if (!norm(last).includes(norm(bible.taglines.signoff))) hard.push(`baris dialog terakhir harus ${bible.hostName} mengucapkan "${bible.taglines.signoff}"`);

  const spoken = norm(w.dialogue.join(" "));
  if (!spoken.includes("panasonic")) hard.push('dialog harus menyebut "Panasonic"');
  for (const name of w.spokenNames.split(";").map((x) => norm(x)).filter(Boolean)) {
    if (!spoken.includes(name)) soft.push(`nama produk "${name}" tidak terdengar utuh di dialog`);
  }
  if (w.dialogue.some((l) => !/:\s*[“"].*[”"]\s*$/.test(l))) soft.push('ada baris dialog yang tidak berformat Nama (aksi): "ucapan"');

  const everything = norm([w.hook, w.problem, w.solution, w.cta, w.caption, ...w.frames, ...w.timing, ...w.dialogue, ...w.overlay].join(" "));
  for (const p of bible.products.filter((x) => !x.usable)) {
    const words2 = [p.key, ...p.name.split(/\s+/).filter((t) => /nanocare|prototipe|prototype/i.test(t))].map(norm).filter(Boolean);
    if (words2.some((t) => t && everything.includes(t))) hard.push(`menyebut produk yang tidak boleh dipakai (${p.key})`);
  }
  return { hard, soft, words };
}

// ---- the run ------------------------------------------------------------------------------------------------------------
export async function generateContent(o: GenerateOptions): Promise<GenerateResult> {
  const model = o.model || DEFAULT_MODEL;
  const system = systemPrompt(o.bible);
  const warnings: string[] = [];
  let provider: Provider = "claude";
  let fellBackBecause: string | undefined;
  const note = (r: { provider: Provider; fellBackBecause?: string }) => {
    if (r.provider === "qwen") {
      provider = "qwen";
      fellBackBecause = fellBackBecause ?? r.fellBackBecause;
    }
  };

  const planned = await aiComplete({ system, user: planPrompt(o), maxTokens: 4000, claudeModel: model });
  note(planned);
  if (planned.truncated) throw new Error("Rencana terpotong (terlalu panjang). Coba kurangi jumlah ide.");
  const { analysis, briefs } = readPlan(planned.text, o.bible, o.count);
  if (briefs.length === 0) throw new Error("Model tidak mengembalikan ide konten dalam format yang benar. Coba lagi.");
  if (!analysis.formula) warnings.push("Analisis rumus hook kosong.");

  const items = await Promise.all(
    briefs.map(async (brief, idx): Promise<ContentItem> => {
      let feedback: string | undefined;
      let written: Written | null = null;
      let check = { hard: [] as string[], soft: [] as string[], words: 0 };
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await aiComplete({ system, user: writePrompt(o, analysis, brief, feedback), maxTokens: 6000, claudeModel: model });
        note(r);
        if (r.truncated) {
          feedback = "jawaban sebelumnya terpotong; tulis lebih ringkas";
          continue;
        }
        written = readWritten(r.text);
        check = checkWritten(written, o.bible);
        if (check.hard.length === 0) break;
        feedback = check.hard.join("; ");
      }
      if (!written) throw new Error(`Konten ${idx + 1}: model tidak menghasilkan jawaban yang utuh.`);
      const itemWarnings = [...check.hard.map((h) => `Belum memenuhi aturan: ${h}`), ...check.soft];

      const parts: PromptParts = {
        productKeys: brief.productKeys, guestKeys: brief.guestKeys, outfitKey: brief.outfitKey,
        frames: written.frames, timing: written.timing, spokenNames: written.spokenNames, dialogue: written.dialogue, overlay: written.overlay,
      };
      return {
        ...brief,
        hook: written.hook, problem: written.problem, solution: written.solution, cta: written.cta,
        frames: written.frames, timing: written.timing, spokenNames: written.spokenNames, dialogue: written.dialogue, overlay: written.overlay, caption: written.caption,
        dialogueWords: check.words,
        warnings: itemWarnings,
        imagePrompt: assembleImagePrompt(o.bible, parts),
        videoPrompt: assembleVideoPrompt(o.bible, parts, check.words),
      };
    })
  );

  return { analysis, items, provider, fellBackBecause, warnings };
}
