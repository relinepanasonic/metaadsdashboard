// ============================================================================
// INSTAGRAM GRAPH API — organic account + post data for Business/Creator
// accounts that are assets of our Meta Business.
// Reuses the same System User token as Meta Ads (META_ACCESS_TOKEN), which
// additionally needs instagram_basic + instagram_manage_insights, and the
// token's user must be assigned to each Instagram account in Business Settings.
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

export interface DayInsights {
  reach?: number;
  views?: number;
  profile_views?: number;
  accounts_engaged?: number;
  total_interactions?: number;
}

const DAY_METRICS = ["reach", "views", "profile_views", "accounts_engaged", "total_interactions"] as const;

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// One metric per request: if Instagram rejects a single metric for an account
// (some are unavailable on smaller accounts) the others still come through.
// Throws only when every metric failed, so a missing permission surfaces.
export async function fetchDayInsights(igUserId: string, date: string): Promise<DayInsights> {
  const results = await Promise.allSettled(
    DAY_METRICS.map(async (metric) => {
      const json = await graph<{ data: { total_value?: { value: number } }[] }>(`/${igUserId}/insights`, {
        metric,
        period: "day",
        metric_type: "total_value",
        since: date,
        until: addDays(date, 1),
      });
      return [metric, json.data[0]?.total_value?.value ?? 0] as const;
    })
  );

  const out: DayInsights = {};
  let firstError: unknown = null;
  for (const r of results) {
    if (r.status === "fulfilled") out[r.value[0]] = r.value[1];
    else firstError ??= r.reason;
  }
  if (Object.keys(out).length === 0 && firstError) throw firstError;
  return out;
}

export interface IgMedia {
  id: string;
  caption?: string;
  media_type?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

export async function fetchRecentMedia(igUserId: string, limit = 30): Promise<IgMedia[]> {
  const json = await graph<{ data: IgMedia[] }>(`/${igUserId}/media`, {
    fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count",
    limit: String(limit),
  });
  return json.data;
}
