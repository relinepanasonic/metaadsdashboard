// Builds the two final prompts (image storyboard + Google Flow video) from the Series Bible and the parts
// the AI wrote. Character, apartment, product profiles and every rule are pasted from the bible word for word,
// so they can never drift. Only the frames, timing, dialogue, overlays and caption vary.

import type { SeriesBible, BibleGuest, BibleProduct } from "./types";

export interface PromptParts {
  productKeys: string[];
  guestKeys: string[];
  outfitKey: string;
  frames: string[]; // 4
  timing: string[]; // 4
  spokenNames: string;
  dialogue: string[];
  overlay: string[];
}

const FRAME_LABELS = ["HOOK", "PROBLEM", "RTB", "CTA + TAGLINE"];
const TIME_LABELS = ["0-10s", "10-20s", "20-30s", "30-40s"];

export function pick<T extends { key: string }>(list: T[], keys: string[]): T[] {
  return keys.map((k) => list.find((x) => x.key === k)).filter((x): x is T => Boolean(x));
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function productBlocks(b: SeriesBible, products: BibleProduct[]): string[] {
  return products.map((p) => `${b.blocks.productPrefix}${p.profile}${b.blocks.productSuffix}`);
}

function guestBlocks(guests: BibleGuest[]): string[] {
  return guests.map((g) => `GUEST CHARACTER — ${g.profile}`);
}

// The pieces both prompts share, in the template's order.
function sharedTop(b: SeriesBible, parts: PromptParts): { guests: BibleGuest[]; products: BibleProduct[]; blocks: string[] } {
  const guests = pick(b.guests, parts.guestKeys);
  const products = pick(b.products, parts.productKeys).filter((p) => p.usable);
  const outfit = b.outfits.find((o) => o.key === parts.outfitKey) ?? b.outfits[0];
  const blocks = [b.host, b.location, ...guestBlocks(guests)];
  if (guests.length > 0) blocks.push(b.blocks.identityLock.replace("{HOST}", b.hostName).replace("{GUESTS}", joinNames(guests.map((g) => g.name))));
  if (outfit) blocks.push(`OUTFIT TODAY: ${outfit.text}`);
  blocks.push(...productBlocks(b, products));
  return { guests, products, blocks };
}

export function assembleImagePrompt(b: SeriesBible, parts: PromptParts): string {
  const { blocks } = sharedTop(b, parts);
  const out = [b.blocks.imageHeader, ...blocks, b.blocks.mood, b.blocks.lensLight, b.blocks.referenceNote];
  out.push(parts.frames.map((f, i) => `FRAME ${i + 1} (${FRAME_LABELS[i]}): ${f}`).join("\n"));
  out.push(b.blocks.storyboardNote);
  return out.join("\n\n");
}

export function assembleVideoPrompt(b: SeriesBible, parts: PromptParts, dialogueWords: number): string {
  const { guests, blocks } = sharedTop(b, parts);
  const voices = [b.hostVoice, ...guests.map((g) => g.voice).filter(Boolean)].join("\n");
  const out = [b.blocks.videoHeader, ...blocks, b.blocks.mood, b.blocks.cameraVideo, voices, b.blocks.referenceNote];
  out.push(`${b.blocks.timingHeader}\n${parts.timing.map((t, i) => `${TIME_LABELS[i]}  ${t}`).join("\n")}`);
  out.push(b.blocks.mandatory.replace("{SPOKEN_NAMES}", parts.spokenNames));
  out.push(`${b.blocks.scriptHeader.replace("{WORDS}", String(dialogueWords))}\n${parts.dialogue.join("\n")}`);
  out.push(`${b.blocks.overlayHeader}\n${parts.overlay.map((t, i) => `${TIME_LABELS[i]} → "${t}"`).join("\n")}\n\n${b.blocks.noOverlayNote}`);
  out.push(b.blocks.durationNote);
  if (guests.length > 0) out.push(b.blocks.multiCharNote);
  return out.join("\n\n");
}

// Words the characters actually say: the text inside the quotes after each "Speaker (action):".
export function countDialogueWords(lines: string[]): number {
  let n = 0;
  for (const l of lines) {
    const q = l.match(/:\s*[“"](.*)[”"]\s*$/);
    const text = q ? q[1] : "";
    n += text.split(/\s+/).filter(Boolean).length;
  }
  return n;
}
