// Viral Radar "Decode": what is the structure of a winning Reel? The prompt, and the reader for the answer.
// Two depths: DEEP = the model watches the video (Gemini, needs GEMINI_API_KEY); LITE = Claude reads the cover image,
// the caption and the numbers (no video, so no transcript and a rougher read).

import { firstOf, parseMarked } from "@/lib/reengine/parse";

export interface Decoded {
  mode: "deep" | "lite" | "text";
  hookType: string; // name of the hook formula
  firstThreeSeconds: string; // exactly what happens and is said in the first 3 seconds
  transcript: string; // spoken words (deep only)
  onScreenText: string;
  structure: string; // beats with timestamps, Hook -> Problem -> Solution -> CTA
  cta: string;
  pacing: string; // length, cuts, energy
  audio: string; // voiceover / trending sound / music
  why: string; // why it likely worked, tied to the numbers
  pattern: string; // reusable pattern with blanks
  keep: string;
  vary: string;
}

export interface DecodeInput {
  handle: string;
  caption: string;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  outlier?: number | null;
  niche?: string | null;
}

const FORMAT = `Balas HANYA dengan penanda berikut, masing-masing di barisnya sendiri (tanpa JSON, tanpa komentar lain):
[[HOOK_TYPE]]
nama singkat rumus hook (mis. "Keluhan relatable lalu solusi", "Mitos vs fakta", "Pertanyaan yang bikin penasaran")
[[FIRST_3_SECONDS]]
apa yang terlihat dan terdengar persis di 3 detik pertama
[[TRANSCRIPT]]
kata-kata yang diucapkan (jika tidak ada suara atau tidak bisa didengar, tulis "tidak tersedia")
[[ON_SCREEN_TEXT]]
teks di layar
[[STRUCTURE]]
beat demi beat dengan perkiraan waktu, mis. "0-3s Hook: ...", "3-12s Problem: ...", "12-30s Solution: ...", "30-35s CTA: ..."
[[CTA]]
ajakan di akhir dan caranya
[[PACING]]
durasi, jumlah potongan, energi, gaya visual
[[AUDIO]]
voiceover, suara tren, atau musik
[[WHY]]
mengapa kemungkinan berhasil, kaitkan dengan angka
[[PATTERN]]
pola yang bisa dipakai ulang dengan bagian kosong
[[KEEP]]
apa yang harus dipertahankan persis
[[VARY]]
apa yang boleh diganti`;

export function decodePrompt(i: DecodeInput, mode: "deep" | "lite" | "text"): string {
  const numbers = [i.views != null ? `${i.views} views` : "", i.likes != null ? `${i.likes} likes` : "", i.comments != null ? `${i.comments} komentar` : "", i.outlier != null ? `${i.outlier}x lebih tinggi dari rata-rata akun itu` : ""].filter(Boolean).join(", ");
  const what = mode === "deep" ? "Tonton video Reel ini" : mode === "lite" ? "Lihat gambar cover Reel ini dan baca caption-nya (videonya tidak tersedia; jangan mengarang transkrip, tulis perkiraan struktur dari caption dan cover)" : "Baca caption Reel ini (videonya dan covernya tidak tersedia; jangan mengarang transkrip, perkirakan struktur dari caption saja)";
  return `${what} dari akun @${i.handle}${i.niche ? ` (niche: ${i.niche})` : ""}. Angka: ${numbers || "tidak tersedia"}.
Caption:
${i.caption || "(kosong)"}

Bongkar mengapa Reel ini menang: rumus hook, struktur, dan polanya, supaya bisa ditiru strukturnya (bukan kata-katanya, footage-nya, atau suaranya).

${FORMAT}`;
}

export function readDecoded(text: string, mode: Decoded["mode"]): Decoded {
  const s = parseMarked(text);
  return {
    mode,
    hookType: firstOf(s, "HOOK_TYPE"),
    firstThreeSeconds: firstOf(s, "FIRST_3_SECONDS"),
    transcript: firstOf(s, "TRANSCRIPT"),
    onScreenText: firstOf(s, "ON_SCREEN_TEXT"),
    structure: firstOf(s, "STRUCTURE"),
    cta: firstOf(s, "CTA"),
    pacing: firstOf(s, "PACING"),
    audio: firstOf(s, "AUDIO"),
    why: firstOf(s, "WHY"),
    pattern: firstOf(s, "PATTERN"),
    keep: firstOf(s, "KEEP"),
    vary: firstOf(s, "VARY"),
  };
}

export function decodeIsUsable(d: Decoded): boolean {
  return Boolean(d.hookType && d.structure && d.pattern);
}

// The decoded reel as plain text, so the Re-Engine can read it as "the original script".
export function decodedToScript(d: Decoded): string {
  return [
    `Rumus hook: ${d.hookType}`,
    `3 detik pertama: ${d.firstThreeSeconds}`,
    d.transcript && !/^tidak tersedia/i.test(d.transcript) ? `Transkrip: ${d.transcript}` : "",
    d.onScreenText ? `Teks di layar: ${d.onScreenText}` : "",
    `Struktur: ${d.structure}`,
    `CTA: ${d.cta}`,
    `Tempo: ${d.pacing}`,
    `Audio: ${d.audio}`,
    `Pola: ${d.pattern}`,
  ].filter(Boolean).join("\n");
}
