import { fetchSerpTop10 } from "./dataforseo";
import { aiComplete, parseJsonAnswer, type Provider } from "./ai";
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

Balas HANYA dengan satu objek JSON valid (tanpa markdown fence, tanpa komentar) dengan bentuk persis:
{
  "title": "string, menarik, di bawah 70 karakter, Bahasa Indonesia",
  "slug": "string, huruf kecil-kebab-case, url-safe, di bawah 60 karakter, potong di batas kata",
  "metaDescription": "string, di bawah 155 karakter, mengandung kata kunci utama",
  "excerpt": "string, 1 kalimat, di bawah 140 karakter",
  "bodyHtml": "string HTML semantik bersih — hanya tag <p>, <h2>, <ul>, <li>, <ol>, <strong>, <em>. 800-1200 kata. Tanpa wrapper <html>/<head>/<body>, tanpa inline style, tanpa gambar",
  "tag": "salah satu dari: ${TAGS.join(" | ")}"
}`;

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
    adaptiveThinking: model.adaptiveThinking,
  });

  let draft: Draft;
  try {
    draft = parseJsonAnswer<Draft>(answer.text);
  } catch {
    throw new Error("Model tidak mengembalikan JSON valid.");
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
