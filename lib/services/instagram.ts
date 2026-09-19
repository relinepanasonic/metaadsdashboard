// ============================================================================
// INSTAGRAM GRAPH API — organic account + post data for Business/Creator
// accounts that are assets of our Meta Business.
// Reuses the same System User token as Meta Ads (META_ACCESS_TOKEN), which
// additionally needs instagram_basic + instagram_manage_insights, and the
// token's user must be assigned to each Instagram account in Business Settings.
//
// Metric names below were checked against the live API (v21.0) — Meta has
// renamed and retired several (plays, impressions, phone_call_clicks, ...), so
// don't add one from memory without testing it.
// ============================================================================

const TOKEN = process.env.META_ACCESS_TOKEN;
const VERSION = process.env.META_API_VERSION || "v21.0";

export const INSTAGRAM_CONFIGURED = Boolean(TOKEN);

export const REQUIRED_PERMISSIONS = ["instagram_basic", "instagram_manage_insights"] as const;

// Shared by the Facebook service too. `token` overrides the default for calls that need a Page access token.
export async function graph<T>(path: string, params: Record<string, string> = {}, token?: string): Promise<T> {
  const access = token ?? TOKEN;
  if (!access) throw new Error("META_ACCESS_TOKEN is not set.");
  const qs = new URLSearchParams({ ...params, access_token: access });
  const res = await fetch(`https://graph.facebook.com/${VERSION}${path}?${qs}`, { cache: "no-store" });
  const json = (await res.json()) as T & { error?: { message: string; code?: number } };
  if (!res.ok || json.error) {
    throw new Error(json.error ? `${json.error.message}${json.error.code ? ` (code ${json.error.code})` : ""}` : `Graph API ${res.status}`);
  }
  return json;
}

export async function fetchGrantedPermissions(): Promise<string[]> {
  const json = await graph<{ data: { permission: string; status: string }[] }>("/me/permissions");
  return json.data.filter((p) => p.status === "granted").map((p) => p.permission);
}

export interface DiscoveredAccount {
  id: string;
  username: string;
  pageName: string;
}

// Instagram accounts reachable through Pages this token can see.
export async function discoverAccounts(): Promise<DiscoveredAccount[]> {
  const json = await graph<{
    data: { name: string; instagram_business_account?: { id: string; username?: string } }[];
  }>("/me/accounts", { fields: "name,instagram_business_account{id,username}", limit: "100" });

  return json.data
    .filter((p) => p.instagram_business_account)
    .map((p) => ({
      id: p.instagram_business_account!.id,
      username: p.instagram_business_account!.username ?? "",
      pageName: p.name,
    }));
}

export interface IgProfile {
  username: string;
  followers_count: number;
  media_count: number;
}

export async function fetchProfile(igUserId: string): Promise<IgProfile> {
  return graph<IgProfile>(`/${igUserId}`, { fields: "username,followers_count,media_count" });
}

// ---------------------------------------------------------------------------
// Daily account insights
// ---------------------------------------------------------------------------
export interface DayInsights {
  reach?: number;
  views?: number;
  profile_views?: number;
  accounts_engaged?: number;
  total_interactions?: number;
  website_clicks?: number;
  profile_links_taps?: number; // taps on the call / email / directions / text buttons
  follows?: number;
  unfollows?: number;
}

const DAY_METRICS = ["reach", "views", "profile_views", "accounts_engaged", "total_interactions", "website_clicks", "profile_links_taps"] as const;

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// One metric per request: if Instagram rejects a single metric for an account
// (some are unavailable on smaller accounts) the others still come through.
// Throws only when every metric failed, so a missing permission surfaces.
export async function fetchDayInsights(igUserId: string, date: string): Promise<DayInsights> {
  const window = { period: "day", metric_type: "total_value", since: date, until: addDays(date, 1) };

  const tasks: Promise<[string, number][]>[] = DAY_METRICS.map(async (metric) => {
    const json = await graph<{ data: { total_value?: { value: number } }[] }>(`/${igUserId}/insights`, { metric, ...window });
    return [[metric, json.data[0]?.total_value?.value ?? 0]];
  });

  // Follows and unfollows come split by follow_type: FOLLOWER = accounts that
  // followed (its 29-day total equalled the summed daily new-follower count on a
  // real account), NON_FOLLOWER = accounts that unfollowed. An empty response
  // means Instagram has no data for the account (e.g. under 100 followers), so
  // it is left empty rather than recorded as a false zero.
  tasks.push(
    (async () => {
      const json = await graph<{ data: { total_value?: { breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } }[] }>(
        `/${igUserId}/insights`,
        { metric: "follows_and_unfollows", breakdown: "follow_type", ...window }
      );
      if (json.data.length === 0) return [];
      const results = json.data[0]?.total_value?.breakdowns?.[0]?.results ?? [];
      const of = (k: string) => results.find((r) => r.dimension_values[0] === k)?.value ?? 0;
      return [
        ["follows", of("FOLLOWER")],
        ["unfollows", of("NON_FOLLOWER")],
      ];
    })()
  );

  const results = await Promise.allSettled(tasks);
  const out: DayInsights = {};
  let firstError: unknown = null;
  for (const r of results) {
    if (r.status === "fulfilled") for (const [k, v] of r.value) (out as Record<string, number>)[k] = v;
    else firstError ??= r.reason;
  }
  if (Object.keys(out).length === 0 && firstError) throw firstError;
  return out;
}

// ---------------------------------------------------------------------------
// Posts and Reels
// ---------------------------------------------------------------------------
export interface IgMedia {
  id: string;
  caption?: string;
  media_type?: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string; // FEED | REELS
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  thumbnail_url?: string;
  media_url?: string;
}

export async function fetchRecentMedia(igUserId: string, limit = 30): Promise<IgMedia[]> {
  const json = await graph<{ data: IgMedia[] }>(`/${igUserId}/media`, {
    fields: "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url",
    limit: String(limit),
  });
  return json.data;
}

export interface PostInsights {
  reach?: number;
  views?: number;
  saved?: number;
  shares?: number;
  total_interactions?: number;
  avg_watch_time_ms?: number; // Reels
  total_watch_ms?: number; // Reels
  follows?: number; // feed posts: follows that came from the post
  profile_visits?: number; // feed posts
}

const POST_FIELD: Record<string, keyof PostInsights> = {
  reach: "reach",
  views: "views",
  saved: "saved",
  shares: "shares",
  total_interactions: "total_interactions",
  ig_reels_avg_watch_time: "avg_watch_time_ms",
  ig_reels_video_view_total_time: "total_watch_ms",
  follows: "follows",
  profile_visits: "profile_visits",
};

type MediaInsightsResponse = { data: { name: string; values?: { value: number }[] }[] };

// Asks for a set of metrics in one call; if Instagram refuses the set (one
// metric unsupported for that media type fails the whole request) it falls back
// to asking one by one so the good ones still land.
async function mediaMetrics(mediaId: string, metrics: string[]): Promise<PostInsights> {
  const out: PostInsights = {};
  const take = (json: MediaInsightsResponse) => {
    for (const d of json.data) {
      const field = POST_FIELD[d.name];
      const v = d.values?.[0]?.value;
      if (field && typeof v === "number") out[field] = v;
    }
  };
  try {
    take(await graph<MediaInsightsResponse>(`/${mediaId}/insights`, { metric: metrics.join(",") }));
  } catch {
    const each = await Promise.allSettled(metrics.map((m) => graph<MediaInsightsResponse>(`/${mediaId}/insights`, { metric: m })));
    for (const r of each) if (r.status === "fulfilled") take(r.value);
  }
  return out;
}

// Reels also report watch time; photos and carousels report follows and profile
// visits that came from the post. Likes and comments already come with the media list.
export async function fetchPostInsights(media: IgMedia): Promise<PostInsights> {
  const isReel = media.media_product_type === "REELS";
  const [base, extra] = await Promise.all([
    mediaMetrics(media.id, ["reach", "views", "saved", "shares", "total_interactions"]),
    mediaMetrics(media.id, isReel ? ["ig_reels_avg_watch_time", "ig_reels_video_view_total_time"] : ["follows", "profile_visits"]),
  ]);
  return { ...base, ...extra };
}

// ---------------------------------------------------------------------------
// Stories — only exist for 24 hours, so they can only be captured while live.
// (Not testable when none are live, so every metric is requested on its own
// and anything Instagram rejects is simply left empty.)
// ---------------------------------------------------------------------------
export interface IgStory {
  id: string;
  media_type?: string;
  permalink?: string;
  timestamp?: string;
  thumbnail_url?: string;
  media_url?: string;
}

export async function fetchStories(igUserId: string): Promise<IgStory[]> {
  const json = await graph<{ data: IgStory[] }>(`/${igUserId}/stories`, { fields: "id,media_type,permalink,timestamp,thumbnail_url,media_url" });
  return json.data;
}

export interface StoryInsights {
  reach?: number;
  views?: number;
  replies?: number;
  shares?: number;
  total_interactions?: number;
  follows?: number;
  profile_visits?: number;
  taps_forward?: number;
  taps_back?: number;
  exits?: number;
  swipes_forward?: number;
}

const STORY_METRICS = ["reach", "views", "replies", "shares", "total_interactions", "follows", "profile_visits"] as const;

const NAVIGATION_FIELD: Record<string, keyof StoryInsights> = {
  TAP_FORWARD: "taps_forward",
  TAP_BACK: "taps_back",
  TAP_EXIT: "exits",
  SWIPE_FORWARD: "swipes_forward",
};

export async function fetchStoryInsights(storyId: string): Promise<StoryInsights> {
  const out: StoryInsights = {};

  const plain = await Promise.allSettled(
    STORY_METRICS.map(async (metric) => {
      const json = await graph<MediaInsightsResponse>(`/${storyId}/insights`, { metric });
      return [metric, json.data[0]?.values?.[0]?.value] as const;
    })
  );
  for (const r of plain) if (r.status === "fulfilled" && typeof r.value[1] === "number") out[r.value[0]] = r.value[1];

  try {
    const nav = await graph<{
      data: { total_value?: { breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } }[];
    }>(`/${storyId}/insights`, { metric: "navigation", breakdown: "story_navigation_action_type" });
    for (const row of nav.data[0]?.total_value?.breakdowns?.[0]?.results ?? []) {
      const field = NAVIGATION_FIELD[row.dimension_values[0]?.toUpperCase()];
      if (field) out[field] = row.value;
    }
  } catch {
    // navigation not available for this story/account — leave the tap counts empty
  }
  return out;
}

// ---------------------------------------------------------------------------
// Audience demographics
// ---------------------------------------------------------------------------
export type Audience = "followers" | "engaged";
export type Breakdown = "age" | "gender" | "city" | "country";

export const AUDIENCES: Audience[] = ["followers", "engaged"];
export const BREAKDOWNS: Breakdown[] = ["age", "gender", "city", "country"];

const DEMOGRAPHIC_METRIC: Record<Audience, string> = {
  followers: "follower_demographics",
  engaged: "engaged_audience_demographics",
};

export interface DemographicRow {
  key: string;
  value: number;
}

// Verified live: follower demographics take no timeframe; engaged-audience ones
// require one and only accept this_month or this_week (Meta dropped the rest in
// v20). Both answer "not enough users" for very small audiences.
export async function fetchDemographics(igUserId: string, audience: Audience, breakdown: Breakdown): Promise<DemographicRow[]> {
  const attempts: (string | undefined)[] = audience === "followers" ? [undefined] : ["this_month", "this_week"];
  let lastError: unknown = null;

  for (const timeframe of attempts) {
    try {
      const json = await graph<{
        data: { total_value?: { breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } }[];
      }>(`/${igUserId}/insights`, {
        metric: DEMOGRAPHIC_METRIC[audience],
        period: "lifetime",
        metric_type: "total_value",
        breakdown,
        ...(timeframe ? { timeframe } : {}),
      });
      const results = json.data[0]?.total_value?.breakdowns?.[0]?.results ?? [];
      if (results.length > 0 || timeframe === attempts[attempts.length - 1]) return results.map((r) => ({ key: r.dimension_values.join(" / "), value: r.value }));
    } catch (err) {
      lastError = err;
      if (/at least 100|100 followers|minimum|permission|not enough users|\(#10\)|\(#200\)/i.test((err as Error).message)) break;
    }
  }
  if (lastError) throw lastError;
  return [];
}
