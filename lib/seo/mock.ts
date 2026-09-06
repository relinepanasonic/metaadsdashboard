// ============================================================================
// SEO#1 — mock data (deterministic; no Math.random / Date.now so server and
// client render identical values). Replace these with real data sources later:
//   - trafficSeries  → GA4 / Search Console API
//   - aiEngines      → GEO tracking (Peec/Otterly/custom AI-mention crawler)
//   - citations      → AI-answer scraping pipeline
//   - coreWebVitals  → PageSpeed Insights / CrUX API
// ============================================================================

export interface TrafficPoint {
  date: string; // "MMM DD"
  organic: number;
  paid: number;
}

// 30 days of organic vs paid Meta traffic, anchored to a constant date so the
// output never changes between renders.
function buildTraffic(): TrafficPoint[] {
  const out: TrafficPoint[] = [];
  const anchor = new Date(2026, 7, 8); // Aug 8 2026, constant
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < 30; i++) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + i);
    const label = `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`;
    // Organic trends upward; paid stays flatter with weekly ripple.
    const organic = Math.round(820 + i * 46 + Math.sin(i / 2.2) * 180 + Math.cos(i / 5) * 120);
    const paid = Math.round(1400 + Math.sin(i / 3.5) * 260 + Math.cos(i / 2) * 140);
    out.push({ date: label, organic, paid });
  }
  return out;
}

export const trafficSeries = buildTraffic();

export const dashboardKpis = {
  organicSessions: trafficSeries.reduce((a, p) => a + p.organic, 0),
  paidSessions: trafficSeries.reduce((a, p) => a + p.paid, 0),
  organicConversions: 486,
  avgPosition: 8.4,
  // Ad Spend Saved = organic clicks × blended Meta CPC they'd otherwise cost.
  adSpendSavedIDR: 42_580_000,
  organicClickValueIDR: 540, // blended CPC used for the estimate
};

export const indexing = {
  indexed: 1284,
  discoveredNotIndexed: 63,
  errors404: 17,
  crawlErrors: 4,
};

// ---------------------------------------------------------------------------
// GEO & AI Visibility
// ---------------------------------------------------------------------------
export interface AiEngineStat {
  engine: string;
  visibility: number; // 0-100, share of tracked prompts that mention the brand
  color: string;
}

export const aeoScore = 62; // overall AI-mention percentage

export const aiEngines: AiEngineStat[] = [
  { engine: "ChatGPT", visibility: 71, color: "#22d3ee" },
  { engine: "Google AI Overviews", visibility: 66, color: "#3b82f6" },
  { engine: "Perplexity", visibility: 54, color: "#8b5cf6" },
  { engine: "Gemini", visibility: 48, color: "#d946ef" },
];

export interface Citation {
  prompt: string;
  engine: string;
  mentioned: boolean;
  competitors: string[];
}

export const citations: Citation[] = [
  { prompt: "Best Panasonic AC dealer in Jakarta", engine: "ChatGPT", mentioned: true, competitors: ["Electronic City", "Hartono"] },
  { prompt: "Where to buy Panasonic rice cooker online Indonesia", engine: "Perplexity", mentioned: false, competitors: ["Tokopedia", "Blibli", "Shopee"] },
  { prompt: "Cheapest dishwasher installation Surabaya", engine: "Gemini", mentioned: true, competitors: ["Bhinneka"] },
  { prompt: "Panasonic authorized service center near me", engine: "Google AI Overviews", mentioned: true, competitors: [] },
  { prompt: "Best air purifier for allergies 2026", engine: "ChatGPT", mentioned: false, competitors: ["Xiaomi", "Sharp", "Philips"] },
  { prompt: "Reliable home appliance store Klampis", engine: "Perplexity", mentioned: true, competitors: ["Hartono", "Electronic Solution"] },
  { prompt: "Panasonic vs Sharp exhaust fan comparison", engine: "Gemini", mentioned: false, competitors: ["Sharp", "KDK"] },
  { prompt: "Best cloud kitchen appliances supplier Bandung", engine: "Google AI Overviews", mentioned: true, competitors: ["Ace Hardware"] },
];

export type AlertLevel = "critical" | "warning" | "info";
export interface SeoAlert {
  level: AlertLevel;
  title: string;
  detail: string;
}

export const geoAlerts: SeoAlert[] = [
  { level: "critical", title: "Cloudflare is blocking ChatGPTBot", detail: "GPTBot receives 403 on 214 URLs — you are invisible to ChatGPT crawling. Allow it in the WAF / robots.txt." },
  { level: "warning", title: "Missing BLUF structure on top blog posts", detail: "7 of your top-10 organic posts lack a Bottom-Line-Up-Front summary AI engines quote from." },
  { level: "warning", title: "No FAQ schema on product pages", detail: "Adding FAQPage schema raises AI Overview citation rate ~30% for commerce queries." },
  { level: "info", title: "Perplexity visibility up +9 pts", detail: "Your 'authorized service center' content is now cited in Perplexity answers." },
];

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------
export interface KeywordMetric {
  keyword: string;
  volume: number;
  difficulty: number; // 0-100
  cpcIDR: number;
  audienceOverlap: boolean; // matches a saved Meta Ads audience
  intent: "Commercial" | "Informational" | "Transactional" | "Navigational";
}

export const keywordResults: KeywordMetric[] = [
  { keyword: "panasonic ac 1 pk murah", volume: 18100, difficulty: 42, cpcIDR: 3200, audienceOverlap: true, intent: "Transactional" },
  { keyword: "harga rice cooker panasonic", volume: 9900, difficulty: 31, cpcIDR: 1800, audienceOverlap: true, intent: "Commercial" },
  { keyword: "cara pasang ac sendiri", volume: 6600, difficulty: 24, cpcIDR: 900, audienceOverlap: false, intent: "Informational" },
  { keyword: "service ac panasonic terdekat", volume: 4400, difficulty: 38, cpcIDR: 2600, audienceOverlap: true, intent: "Navigational" },
  { keyword: "air purifier terbaik 2026", volume: 3600, difficulty: 55, cpcIDR: 4100, audienceOverlap: false, intent: "Commercial" },
];

export interface SerpRow {
  rank: number;
  url: string;
  domain: string;
  da: number; // domain authority
  isYou: boolean;
}

export const serpTable: SerpRow[] = [
  { rank: 1, url: "electroniccity.co.id/ac/panasonic", domain: "electroniccity.co.id", da: 62, isYou: false },
  { rank: 2, url: "tokopedia.com/panasonic-ac", domain: "tokopedia.com", da: 91, isYou: false },
  { rank: 3, url: "proftokoonline.id/panasonic-ac-1pk", domain: "proftokoonline.id", da: 34, isYou: true },
  { rank: 4, url: "blibli.com/ac-panasonic", domain: "blibli.com", da: 88, isYou: false },
  { rank: 5, url: "hartono.co.id/ac", domain: "hartono.co.id", da: 51, isYou: false },
  { rank: 6, url: "shopee.co.id/panasonic-official", domain: "shopee.co.id", da: 93, isYou: false },
  { rank: 7, url: "bhinneka.com/ac-panasonic", domain: "bhinneka.com", da: 66, isYou: false },
  { rank: 8, url: "panasonic.com/id/ac", domain: "panasonic.com", da: 84, isYou: false },
  { rank: 9, url: "electronicsolution.co.id/ac", domain: "electronicsolution.co.id", da: 44, isYou: false },
  { rank: 10, url: "aceonline.co.id/ac-panasonic", domain: "aceonline.co.id", da: 58, isYou: false },
];

// ---------------------------------------------------------------------------
// Content Engine
// ---------------------------------------------------------------------------
export type PipelineStage = "Briefing" | "AI Drafting" | "Review" | "Published";
export interface ContentItem {
  id: string;
  title: string;
  keyword: string;
  tone: string;
  stage: PipelineStage;
  words: number;
  aeoOptimized: boolean;
}

export const contentPipeline: ContentItem[] = [
  { id: "c1", title: "Panduan Memilih AC 1 PK untuk Kamar Kecil", keyword: "panasonic ac 1 pk", tone: "Helpful", stage: "Briefing", words: 0, aeoOptimized: false },
  { id: "c2", title: "5 Rice Cooker Terbaik untuk Keluarga 2026", keyword: "rice cooker panasonic", tone: "Persuasive", stage: "Briefing", words: 0, aeoOptimized: false },
  { id: "c3", title: "Cara Merawat AC agar Awet & Hemat Listrik", keyword: "cara merawat ac", tone: "Educational", stage: "AI Drafting", words: 640, aeoOptimized: true },
  { id: "c4", title: "Air Purifier vs AC: Mana yang Kamu Butuhkan?", keyword: "air purifier terbaik", tone: "Neutral", stage: "AI Drafting", words: 410, aeoOptimized: true },
  { id: "c5", title: "Panasonic Authorized Service Center: Kenapa Penting", keyword: "service ac panasonic", tone: "Trustworthy", stage: "Review", words: 1180, aeoOptimized: true },
  { id: "c6", title: "Harga & Spesifikasi Dishwasher Panasonic Terbaru", keyword: "dishwasher panasonic", tone: "Informative", stage: "Published", words: 1420, aeoOptimized: true },
];

// ---------------------------------------------------------------------------
// Technical & Indexing
// ---------------------------------------------------------------------------
export interface CwvMetric {
  label: string;
  mobile: number;
  desktop: number;
  unit: string;
  goodBelow: number; // threshold: <= good
}

export const coreWebVitals: CwvMetric[] = [
  { label: "LCP (Largest Contentful Paint)", mobile: 2.9, desktop: 1.4, unit: "s", goodBelow: 2.5 },
  { label: "INP (Interaction to Next Paint)", mobile: 180, desktop: 90, unit: "ms", goodBelow: 200 },
  { label: "CLS (Cumulative Layout Shift)", mobile: 0.06, desktop: 0.02, unit: "", goodBelow: 0.1 },
];

export const performanceScore = { mobile: 74, desktop: 96 };

export interface CrawlerRule {
  bot: string;
  purpose: string;
  allowed: boolean;
}

export const crawlerChecklist: CrawlerRule[] = [
  { bot: "Googlebot", purpose: "Google Search indexing", allowed: true },
  { bot: "GPTBot", purpose: "ChatGPT training & browsing", allowed: false },
  { bot: "OAI-SearchBot", purpose: "ChatGPT Search citations", allowed: false },
  { bot: "PerplexityBot", purpose: "Perplexity answer citations", allowed: true },
  { bot: "ClaudeBot", purpose: "Claude citations", allowed: true },
  { bot: "Google-Extended", purpose: "Gemini / AI Overviews", allowed: true },
  { bot: "Bingbot", purpose: "Bing + Copilot indexing", allowed: true },
];

export const technicalAlerts: SeoAlert[] = [
  { level: "critical", title: "GPTBot & OAI-SearchBot disallowed", detail: "Your robots.txt blocks both OpenAI crawlers — no ChatGPT visibility is possible until allowed." },
  { level: "warning", title: "Mobile LCP above 2.5s", detail: "Largest Contentful Paint is 2.9s on mobile. Compress hero images and preload the LCP element." },
];
