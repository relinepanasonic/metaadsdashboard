import { fetchSerpTop10 } from "./dataforseo";
import { aiComplete, parseJsonAnswer, parseSections, type Provider } from "./ai";
import { FIRSTHAND_MARKER, MODEL_OPTIONS, DEFAULT_MODEL, type ModelId } from "@/lib/seo/constants";

// The website template maps these to CSS classes — they must stay exactly these
// five English strings even though the article itself is Indonesian.
const TAGS = ["Optimization", "Indonesia News", "Foreign Sellers", "Consumer Behavior", "Case Study"] as const;

export interface Draft {
  title: string;
  slug: string;
  metaDescription: string;
  excerpt: string;
  bodyHtml: string;
  tag: string;
  provider?: Provider; // which model wrote it (Claude, or Qwen when Claude was unavailable)
  fellBackBecause?: string;
}

function systemPrompt(autopilot: boolean): string {
  return SYSTEM_BASE.replace("__RULE5__", autopilot ? RULE5_AUTOPILOT : RULE5_MANUAL);
}

const RULE5_MANUAL = `5. Artikel HARUS memuat tepat satu bagian <h2>Dari Pengalaman Kami</h2> yang isinya persis satu paragraf placeholder:
   <p>${FIRSTHAND_MARKER} — contoh nyata dari toko yang kamu tangani, angka asli, atau kesalahan yang sering kamu temui]</p>
   Jangan diisi sendiri. Biarkan persis seperti itu.`;

// Unattended posts have nobody to fill in real experience, and the model must not invent it, so the section is simply left out.
const RULE5_AUTOPILOT = `5. JANGAN menulis bagian "Dari Pengalaman Kami" dan JANGAN mengaku punya pengalaman pribadi, klien, atau hasil nyata. Tulis panduan praktis berbasis prinsip yang umum diketahui.`;

const SYSTEM_BASE = `Kamu penulis konten untuk "Profesor Toko Online", konsultan optimasi e-commerce di Indonesia (sejak 2021), melayani seller Shopee, TikTok Shop, dan Tokopedia. Layanan: optimasi toko, friend order, editing foto/video produk, rekrutmen TikTok affiliate.

ATURAN YANG TIDAK BOLEH DILANGGAR:
1. Tulis SELURUHNYA dalam Bahasa Indonesia yang natural — bukan terjemahan kaku dari Inggris.
2. JANGAN mengarang statistik, persentase, angka pasar, atau nilai GMV. Kalau sebuah klaim butuh angka yang tidak kamu ketahui pasti, tulis kalimatnya tanpa angka.
3. JANGAN mengarang studi kasus, hasil klien, testimoni, atau nama brand. Dilarang keras menulis "toko X naik 3.5x" kalau datanya tidak diberikan.
4. JANGAN menyebut regulasi/hukum kecuali kamu yakin namanya benar. Undang-undang perlindungan data Indonesia adalah UU PDP (UU No. 27/2022) — BUKAN "PDPA".
__RULE5__

Gaya: percaya diri, langsung, berbasis data, tanpa basa-basi, premium tapi membumi.

Balas HANYA dengan bagian-bagian berikut, masing-masing diawali baris penanda persis seperti ini (BUKAN JSON, tanpa markdown fence, tanpa komentar di luar bagian):
===TITLE===
judul menarik, di bawah 70 karakter, Bahasa Indonesia
===SLUG===
huruf kecil-kebab-case, url-safe, di bawah 60 karakter, potong di batas kata
===META===
di bawah 155 karakter, mengandung kata kunci utama
===EXCERPT===
1 kalimat, di bawah 140 karakter
===TAG===
salah satu dari: ${TAGS.join(" | ")}
===BODY===
HTML semantik bersih — hanya tag <p>, <h2>, <ul>, <li>, <ol>, <strong>, <em>. 800-1200 kata. Tanpa wrapper <html>/<head>/<body>, tanpa inline style, tanpa gambar. Boleh memakai tanda kutip biasa di dalam teks.`;

function cleanSlug(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (s.length <= 60) return s;
  // Cut at a word boundary so slugs never end mid-word.
  return s.slice(0, 60).replace(/-[^-]*$/, "");
}

export async function draftPost(keyword: string, modelId: ModelId = DEFAULT_MODEL, opts: { autopilot?: boolean } = {}): Promise<Draft> {
  const model = MODEL_OPTIONS.find((m) => m.id === modelId) ?? MODEL_OPTIONS[0];

  // Give Claude the live top 10 so it writes against what actually ranks today
  // rather than from memory. Non-fatal if it fails.
  let serpContext = "";
  try {
    const serp = await fetchSerpTop10(keyword);
    if (serp.length > 0) {
      serpContext =
        `\n\nHalaman yang saat ini ranking di Google Indonesia untuk kata kunci ini:\n` +
        serp.map((r) => `${r.rank}. ${r.url}`).join("\n") +
        `\n\nTulis artikel yang lebih lengkap dan lebih berguna daripada halaman-halaman itu.`;
    }
  } catch {
    // SERP is context, not a requirement.
  }

  const answer = await aiComplete({
    system: systemPrompt(Boolean(opts.autopilot)),
    user: `Tulis satu artikel blog yang menargetkan kata kunci: "${keyword}".${serpContext}`,
    maxTokens: 16000,
    claudeModel: model.id,
    // An unattended run skips the thinking phase: thinking shares the token budget, and a long article plus thinking
    // can run out mid-JSON (that is what made the first autopilot run fail).
    adaptiveThinking: opts.autopilot ? false : model.adaptiveThinking,
  });
  if (answer.truncated) throw new Error("Model berhenti di tengah artikel (terlalu panjang). Coba lagi.");

  let draft: Draft;
  const sections = parseSections(answer.text, ["TITLE", "SLUG", "META", "EXCERPT", "TAG", "BODY"]);
  if (sections) {
    draft = { title: sections.TITLE, slug: sections.SLUG, metaDescription: sections.META, excerpt: sections.EXCERPT, tag: sections.TAG, bodyHtml: sections.BODY };
  } else {
    // An older-style JSON answer (or a model that ignored the format) is still accepted.
    try {
      draft = parseJsonAnswer<Draft>(answer.text);
    } catch {
      const t = answer.text;
      throw new Error(`Model tidak mengembalikan format yang benar (${answer.provider}; ${t.length} karakter; awal: ${JSON.stringify(t.slice(0, 80))}; akhir: ${JSON.stringify(t.slice(-80))}).`);
    }
  }

  for (const key of ["title", "slug", "metaDescription", "excerpt", "bodyHtml", "tag"] as const) {
    if (!draft[key] || typeof draft[key] !== "string") throw new Error(`Draft tidak lengkap: ${key}`);
  }

  draft.slug = cleanSlug(draft.slug);
  if (!TAGS.includes(draft.tag as (typeof TAGS)[number])) draft.tag = "Optimization";
  draft.provider = answer.provider;
  draft.fellBackBecause = answer.fellBackBecause;

  return draft;
}
