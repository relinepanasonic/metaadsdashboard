// Re-Engine: turns a successful post into new content prompts for Google Flow (Veo) and an image generator.
// Everything that must stay identical from video to video (the character, the apartment, each product's
// physical profile, the rules) lives in a "Series Bible". The AI only writes the parts that change.

export interface BibleOutfit {
  key: string;
  label: string;
  text: string;
}

export interface BibleProduct {
  key: string;
  name: string; // how it is named in the briefs
  profile: string; // physical description, pasted into every prompt that shows the product
  claims: string; // the ONLY facts the script may say about it
  source: string;
  note: string;
  usable: boolean; // false = pre-launch / not allowed in content yet
}

export interface BibleGuest {
  key: string;
  name: string;
  role: string; // e.g. "sahabat Miss Pan"
  profile: string;
  voice: string;
}

export interface BibleBlocks {
  imageHeader: string;
  videoHeader: string;
  identityLock: string; // {HOST} and {GUESTS} are filled in
  mood: string;
  lensLight: string;
  cameraVideo: string;
  referenceNote: string;
  storyboardNote: string;
  productPrefix: string;
  productSuffix: string;
  mandatory: string; // {SPOKEN_NAMES} is filled in
  timingHeader: string;
  scriptHeader: string; // {WORDS} is filled in
  overlayHeader: string;
  noOverlayNote: string;
  durationNote: string;
  multiCharNote: string;
}

export interface SeriesBible {
  seriesName: string;
  hostName: string;
  host: string;
  location: string;
  hostVoice: string;
  taglines: { main: string; long: string; signoff: string };
  outfits: BibleOutfit[];
  products: BibleProduct[];
  guests: BibleGuest[];
  blocks: BibleBlocks;
  rules: string[];
  example: string; // one finished content in the writer's output format, shown to the AI as the quality bar
  exampleMeta: { format: string; title: string; product: string };
}

// What the AI decides for one new content.
export interface ContentBrief {
  format: string; // e.g. "REELS · Tamu Dadakan"
  title: string;
  angle: string; // one line: what makes this different from the other ideas
  productKeys: string[];
  guestKeys: string[];
  outfitKey: string;
}

export interface ContentItem extends ContentBrief {
  hook: string;
  problem: string;
  solution: string;
  cta: string;
  frames: string[]; // 4
  timing: string[]; // 4 (0-10s, 10-20s, 20-30s, 30-40s)
  spokenNames: string; // product names as spoken, e.g. "stick vacuum cordless Panasonic; handy steamer Panasonic"
  dialogue: string[]; // lines: Speaker (action): "text"
  overlay: string[]; // 4
  caption: string; // caption + hashtags
  dialogueWords: number;
  warnings: string[];
  imagePrompt: string;
  videoPrompt: string;
}

export interface SourceAnalysis {
  formula: string; // name of the hook formula
  pattern: string; // the reusable hook pattern with blanks
  structure: string; // Hook -> Problem -> Solution -> CTA beats of the source
  why: string; // why it worked, tied to the numbers
  keep: string; // what to keep exactly
  vary: string; // what to change
}

export interface SourcePost {
  mediaId?: string;
  permalink?: string | null;
  account?: string;
  postedAt?: string | null;
  caption: string;
  script?: string; // optional: the original script / prompt, for a better structure read
  metrics?: { views?: number | null; reach?: number | null; likes?: number | null; comments?: number | null; saves?: number | null; shares?: number | null; avgWatchSec?: number | null; skipRate?: number | null };
  verdicts?: { hook?: string; value?: string; cta?: string; hookWhy?: string; valueWhy?: string; ctaWhy?: string };
}
