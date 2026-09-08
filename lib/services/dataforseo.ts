// ============================================================================
// DATAFORSEO SERVICE — keyword research + competitor SERP data.
// Simple pay-as-you-go REST API, Basic Auth (login:password, base64).
//
// Env vars (server-side only):
//   DATAFORSEO_LOGIN     API login (from the DataForSEO API Access page)
//   DATAFORSEO_PASSWORD  API password (from the same page)
//
// Location/language are pinned to Indonesia (location_code 2360, "id") since
// that's the market this app serves.
// ============================================================================

const LOGIN = process.env.DATAFORSEO_LOGIN;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;

export const DATAFORSEO_CONFIGURED = Boolean(LOGIN && PASSWORD);

const API_BASE = "https://api.dataforseo.com/v3";
const LOCATION_CODE = 2360; // Indonesia
const LANGUAGE_CODE = "id";

function authHeader(): string {
  return "Basic " + Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
}

interface DfsEnvelope<T> {
  status_code: number;
  status_message: string;
  tasks?: Array<{
    status_code: number;
    status_message: string;
    result?: T[];
  }>;
}

async function dfsPost<T>(path: string, body: Record<string, unknown>[]): Promise<T[]> {
  if (!DATAFORSEO_CONFIGURED) throw new Error("DataForSEO is not configured yet.");

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO API ${res.status}: ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as DfsEnvelope<T>;
  if (json.status_code !== 20000) {
    throw new Error(`DataForSEO: ${json.status_message}`);
  }
  const task = json.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(`DataForSEO task failed: ${task?.status_message ?? "unknown error"}`);
  }
  return task.result ?? [];
}

export type KeywordIntent = "Commercial" | "Informational" | "Transactional" | "Navigational";

export interface KeywordIdea {
  keyword: string;
  volume: number;
  difficulty: number; // 0-100
  cpcUsd: number;
  intent: KeywordIntent;
}

const INTENT_MAP: Record<string, KeywordIntent> = {
  commercial: "Commercial",
  informational: "Informational",
  transactional: "Transactional",
  navigational: "Navigational",
};

interface KeywordIdeasResult {
  items?: Array<{
    keyword: string;
    keyword_info?: { search_volume?: number; cpc?: number };
    keyword_properties?: { keyword_difficulty?: number };
    search_intent_info?: { main_intent?: string } | null;
  }>;
}

// Real related-keyword ideas for a seed term (volume, difficulty, CPC, intent).
export async function fetchKeywordIdeas(seed: string, limit = 30): Promise<KeywordIdea[]> {
  const results = await dfsPost<KeywordIdeasResult>("/dataforseo_labs/google/keyword_ideas/live", [
    {
      keywords: [seed],
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      limit,
    },
  ]);

  const items = results[0]?.items ?? [];
  return items
    .map((it) => ({
      keyword: it.keyword,
      volume: it.keyword_info?.search_volume ?? 0,
      difficulty: Math.round(it.keyword_properties?.keyword_difficulty ?? 0),
      cpcUsd: it.keyword_info?.cpc ?? 0,
      intent: INTENT_MAP[it.search_intent_info?.main_intent ?? ""] ?? "Informational",
    }))
    .sort((a, b) => b.volume - a.volume);
}

export interface SerpResult {
  rank: number;
  url: string;
}

interface SerpOrganicResult {
  items?: Array<{ type: string; rank_absolute?: number; url?: string }>;
}

// Real top-10 organic Google results for a keyword right now.
export async function fetchSerpTop10(keyword: string): Promise<SerpResult[]> {
  const results = await dfsPost<SerpOrganicResult>("/serp/google/organic/live/advanced", [
    {
      keyword,
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      device: "desktop",
      depth: 10,
    },
  ]);

  const items = results[0]?.items ?? [];
  return items
    .filter((it) => it.type === "organic" && it.url)
    .slice(0, 10)
    .map((it, i) => ({
      rank: it.rank_absolute ?? i + 1,
      url: (it.url as string).replace(/^https?:\/\//, ""),
    }));
}

// Strips protocol / "sc-domain:" / "www." / trailing slash so a Search
// Console site_url or a user-typed URL becomes a bare domain DataForSEO expects.
export function bareDomain(input: string): string {
  return input
    .replace(/^sc-domain:/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .trim();
}

export interface DomainOverview {
  domain: string;
  organicKeywords: number;
  organicTrafficEst: number;
}

interface DomainRankOverviewResult {
  items?: Array<{ metrics?: { organic?: { count?: number; etv?: number } } }>;
}

// Ballpark organic footprint for a domain: how many keywords it ranks for,
// and roughly how much monthly organic traffic that's worth.
export async function fetchDomainRankOverview(domain: string): Promise<DomainOverview> {
  const results = await dfsPost<DomainRankOverviewResult>("/dataforseo_labs/google/domain_rank_overview/live", [
    { target: bareDomain(domain), location_code: LOCATION_CODE, language_code: LANGUAGE_CODE },
  ]);
  const item = results[0]?.items?.[0];
  return {
    domain: bareDomain(domain),
    organicKeywords: item?.metrics?.organic?.count ?? 0,
    organicTrafficEst: Math.round(item?.metrics?.organic?.etv ?? 0),
  };
}

export interface CompetitorDomain {
  domain: string;
  avgPosition: number;
  intersections: number;
  organicKeywords: number;
  organicTrafficEst: number;
}

interface CompetitorsDomainResult {
  items?: Array<{
    domain: string;
    avg_position?: number;
    intersections?: number;
    metrics?: { organic?: { count?: number; etv?: number } };
  }>;
}

// Auto-discovers domains that overlap with yours the most in Google rankings
// — the real answer to "who are my competitors", no guessing required.
export async function fetchCompetitorsDomain(domain: string, limit = 10): Promise<CompetitorDomain[]> {
  const results = await dfsPost<CompetitorsDomainResult>("/dataforseo_labs/google/competitors_domain/live", [
    { target: bareDomain(domain), location_code: LOCATION_CODE, language_code: LANGUAGE_CODE, limit },
  ]);

  const items = results[0]?.items ?? [];
  return items
    .filter((it) => it.domain)
    .map((it) => ({
      domain: it.domain,
      avgPosition: Math.round((it.avg_position ?? 0) * 10) / 10,
      intersections: it.intersections ?? 0,
      organicKeywords: it.metrics?.organic?.count ?? 0,
      organicTrafficEst: Math.round(it.metrics?.organic?.etv ?? 0),
    }));
}

export interface GapKeyword {
  keyword: string;
  volume: number;
  competitorPosition: number;
}

interface DomainIntersectionResult {
  items?: Array<{
    keyword_data?: { keyword?: string; keyword_info?: { search_volume?: number } };
    first_domain_serp_element?: { serp_item?: { rank_absolute?: number } } | null;
    second_domain_serp_element?: { serp_item?: { rank_absolute?: number } } | null;
  }>;
}

// The content gap: real keywords the competitor ranks for that your domain
// currently does not. target1 = competitor, target2 = you.
export async function fetchKeywordGap(yourDomain: string, competitorDomain: string, limit = 50): Promise<GapKeyword[]> {
  const results = await dfsPost<DomainIntersectionResult>("/dataforseo_labs/google/domain_intersection/live", [
    {
      target1: bareDomain(competitorDomain),
      target2: bareDomain(yourDomain),
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      limit,
      intersections: false, // false = union of both domains' rankings, not just overlap
    },
  ]);

  const items = results[0]?.items ?? [];
  return items
    .filter((it) => it.keyword_data?.keyword && it.first_domain_serp_element?.serp_item && !it.second_domain_serp_element?.serp_item)
    .map((it) => ({
      keyword: it.keyword_data!.keyword as string,
      volume: it.keyword_data?.keyword_info?.search_volume ?? 0,
      competitorPosition: it.first_domain_serp_element!.serp_item!.rank_absolute ?? 0,
    }))
    .sort((a, b) => b.volume - a.volume);
}
