// ============================================================================
// GOOGLE ADS SERVICE — REST client + daily sync into Supabase
// ----------------------------------------------------------------------------
// Talks to the Google Ads API over plain REST (GAQL via googleAds:searchStream),
// authenticating with a user OAuth refresh token. No SDK, no developer-token
// dependency (Google retired the header on 9 Sep 2026; it is still sent when
// GOOGLE_ADS_DEVELOPER_TOKEN is set so older projects keep working).
//
// The dashboard never calls Google directly: syncGoogleAccount() copies data
// into the google_ads_* tables and the pages read from there.
//
// Env (set in Vercel by the account owner — never in chat or the repo):
//   GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET   OAuth client (Web)
//   GOOGLE_ADS_REFRESH_TOKEN                          from /api/google-ads/oauth/start
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID   optional: manager (MCC) id when accounts sit under one
//   GOOGLE_ADS_DEVELOPER_TOKEN     optional / legacy
//   GOOGLE_ADS_API_VERSION         optional, default v25
// ============================================================================

import { db } from "@/lib/supabase/db";

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v25";
const API = `https://googleads.googleapis.com/${API_VERSION}`;

export const GOOGLE_OAUTH_SCOPE = "https://www.googleapis.com/auth/adwords";

export function googleOauthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET);
}

export function googleConfigured(): boolean {
  return googleOauthConfigured() && Boolean(process.env.GOOGLE_ADS_REFRESH_TOKEN);
}

// Kept for the Overview aggregator: true when credentials exist.
export const GOOGLE_CONNECTED = googleConfigured();

export function cleanCustomerId(id: string | null | undefined): string {
  return (id ?? "").replace(/[^0-9]/g, "");
}

// ---------------------------------------------------------------- auth -----

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  if (!googleConfigured()) throw new Error("Google Ads is not connected — set the GOOGLE_ADS_* environment variables.");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    const why = json.error_description || json.error || `HTTP ${res.status}`;
    throw new Error(
      json.error === "invalid_grant"
        ? `Google rejected the refresh token (${why}). If the OAuth consent screen is still in "Testing", tokens expire after 7 days — publish it to "In production" and reconnect.`
        : `Google sign-in failed: ${why}`
    );
  }
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function headers(loginCustomerId?: string): Promise<Record<string, string>> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    "Content-Type": "application/json",
  };
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) h["developer-token"] = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const login = cleanCustomerId(loginCustomerId ?? process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  if (login) h["login-customer-id"] = login;
  return h;
}

interface GoogleErrorBody {
  error?: { message?: string; status?: string; details?: { errors?: { message?: string; errorCode?: Record<string, string> }[] }[] };
}

function describeError(status: number, body: GoogleErrorBody | null): string {
  const first = body?.error?.details?.flatMap((d) => d.errors ?? [])[0];
  const code = first?.errorCode ? Object.values(first.errorCode)[0] : body?.error?.status;
  const msg = first?.message || body?.error?.message || `HTTP ${status}`;
  return code ? `${msg} [${code}]` : msg;
}

// Runs one GAQL query and returns every row (searchStream batches are flattened).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GaqlRow = any;

export async function gaql(customerId: string, query: string, loginCustomerId?: string): Promise<GaqlRow[]> {
  const res = await fetch(`${API}/customers/${cleanCustomerId(customerId)}/googleAds:searchStream`, {
    method: "POST",
    headers: await headers(loginCustomerId),
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(describeError(res.status, Array.isArray(json) ? json[0] : json));
  return (Array.isArray(json) ? json : [json]).flatMap((batch: { results?: GaqlRow[] }) => batch?.results ?? []);
}

// Every account the connected Google login can open (ids only).
export async function listAccessibleCustomers(): Promise<string[]> {
  const res = await fetch(`${API}/customers:listAccessibleCustomers`, { headers: await headers(), cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(describeError(res.status, json));
  return ((json?.resourceNames ?? []) as string[]).map((r) => r.replace("customers/", ""));
}

export interface AccountInfo {
  customerId: string;
  name: string;
  currency: string;
  timeZone: string;
  isManager: boolean;
}

export async function fetchAccountInfo(customerId: string, loginCustomerId?: string): Promise<AccountInfo> {
  const rows = await gaql(
    customerId,
    "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager FROM customer LIMIT 1",
    loginCustomerId
  );
  const c = rows[0]?.customer ?? {};
  return {
    customerId: cleanCustomerId(customerId),
    name: c.descriptiveName || cleanCustomerId(customerId),
    currency: c.currencyCode || "",
    timeZone: c.timeZone || "",
    isManager: Boolean(c.manager),
  };
}

// Client accounts under a manager (MCC), one level down.
export async function listManagedAccounts(managerId: string): Promise<AccountInfo[]> {
  const rows = await gaql(
    managerId,
    "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.level = 1 AND customer_client.status = 'ENABLED'",
    managerId
  );
  return rows.map((r) => ({
    customerId: String(r.customerClient.id),
    name: r.customerClient.descriptiveName || String(r.customerClient.id),
    currency: r.customerClient.currencyCode || "",
    timeZone: r.customerClient.timeZone || "",
    isManager: Boolean(r.customerClient.manager),
  }));
}

// ---------------------------------------------------------------- sync -----

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const optNum = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const money = (micros: unknown): number => Math.round((num(micros) / 1_000_000) * 100) / 100;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Jakarta calendar date (UTC+7) — where these accounts live.
export function jakartaToday(): Date {
  return new Date(Date.now() + 7 * 3600 * 1000);
}

function daysBefore(base: Date, n: number): string {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() - n);
  return isoDay(d);
}

async function upsertChunks(table: string, rows: Record<string, unknown>[], onConflict: string) {
  if (!db || rows.length === 0) return;
  // One batch may not name the same key twice (Postgres refuses to update a row
  // twice in one statement), so keep the last occurrence of each key.
  const cols = onConflict.split(",");
  const unique = [...new Map(rows.map((r) => [cols.map((c) => String(r[c])).join(""), r])).values()];
  for (let i = 0; i < unique.length; i += 500) {
    const { error } = await db.from(table).upsert(unique.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

interface Metrics {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conv_value: number;
}

const zero = (): Metrics => ({ impressions: 0, clicks: 0, cost: 0, conversions: 0, conv_value: 0 });
const readMetrics = (m: GaqlRow): Metrics => ({
  impressions: num(m?.impressions),
  clicks: num(m?.clicks),
  cost: money(m?.costMicros),
  conversions: Math.round(num(m?.conversions) * 100) / 100,
  conv_value: Math.round(num(m?.conversionsValue) * 100) / 100,
});
const METRIC_FIELDS = "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value";

function addInto(target: Metrics, m: Metrics) {
  target.impressions += m.impressions;
  target.clicks += m.clicks;
  target.cost += m.cost;
  target.conversions += m.conversions;
  target.conv_value += m.conv_value;
}

export interface GoogleSyncResult {
  customerId: string;
  name: string;
  campaignDays: number;
  segments: number;
  items: number;
  errors: string[];
}

// Pulls `days` days of history for one account and stores it. The campaign
// table is fatal if it fails; every other section is best-effort so one
// unsupported report never blocks the rest.
export async function syncGoogleAccount(customerIdRaw: string, days = 30): Promise<GoogleSyncResult> {
  if (!db) throw new Error("Supabase is not configured.");
  const customerId = cleanCustomerId(customerIdRaw);
  const errors: string[] = [];
  const today = jakartaToday();
  const since = daysBefore(today, days);
  const until = isoDay(today);
  const between = `segments.date BETWEEN '${since}' AND '${until}'`;

  try {
    const info = await fetchAccountInfo(customerId);

    // ---- campaign x day -----------------------------------------------
    const campRows = await gaql(
      customerId,
      `SELECT segments.date, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
              campaign.bidding_strategy_type, campaign_budget.amount_micros, ${METRIC_FIELDS},
              metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share
       FROM campaign WHERE ${between} AND campaign.status != 'REMOVED'`
    );
    const campaignDaily = campRows.map((r) => ({
      customer_id: customerId,
      campaign_id: String(r.campaign.id),
      date: r.segments.date,
      campaign_name: r.campaign.name ?? null,
      status: r.campaign.status ?? null,
      channel_type: r.campaign.advertisingChannelType ?? null,
      bidding: r.campaign.biddingStrategyType ?? null,
      budget: r.campaignBudget?.amountMicros != null ? money(r.campaignBudget.amountMicros) : null,
      ...readMetrics(r.metrics),
      search_is: optNum(r.metrics?.searchImpressionShare),
      lost_is_budget: optNum(r.metrics?.searchBudgetLostImpressionShare),
      lost_is_rank: optNum(r.metrics?.searchRankLostImpressionShare),
    }));
    await upsertChunks("google_ads_campaign_daily", campaignDaily, "customer_id,campaign_id,date");

    // ---- account x day x dimension ---------------------------------------
    const segRows: Record<string, unknown>[] = [];
    const collect = async (
      dimension: string,
      query: string,
      keyOf: (r: GaqlRow) => string | null
    ) => {
      try {
        const rows = await gaql(customerId, query);
        const agg = new Map<string, { date: string; key: string; m: Metrics }>();
        for (const r of rows) {
          const key = keyOf(r);
          if (key == null) continue;
          const id = `${r.segments.date}|${key}`;
          const cur = agg.get(id) ?? { date: r.segments.date, key, m: zero() };
          addInto(cur.m, readMetrics(r.metrics));
          agg.set(id, cur);
        }
        for (const { date, key, m } of agg.values()) {
          segRows.push({ customer_id: customerId, date, dimension, key, ...m });
        }
      } catch (e) {
        errors.push(`${dimension}: ${(e as Error).message}`);
      }
    };
    await Promise.all([
      collect("device", `SELECT segments.date, segments.device, ${METRIC_FIELDS} FROM customer WHERE ${between}`, (r) => r.segments.device ?? "UNKNOWN"),
      collect("network", `SELECT segments.date, segments.ad_network_type, ${METRIC_FIELDS} FROM customer WHERE ${between}`, (r) => r.segments.adNetworkType ?? "UNKNOWN"),
      collect("hour", `SELECT segments.date, segments.hour, ${METRIC_FIELDS} FROM customer WHERE ${between}`, (r) => String(r.segments.hour ?? 0)),
      collect("age", `SELECT segments.date, ad_group_criterion.age_range.type, ${METRIC_FIELDS} FROM age_range_view WHERE ${between}`, (r) => r.adGroupCriterion?.ageRange?.type ?? null),
      collect("gender", `SELECT segments.date, ad_group_criterion.gender.type, ${METRIC_FIELDS} FROM gender_view WHERE ${between}`, (r) => r.adGroupCriterion?.gender?.type ?? null),
    ]);
    await upsertChunks("google_ads_segment_daily", segRows, "customer_id,date,dimension,key");

    // ---- rolling last-30-day leaderboards -----------------------------------
    const runStart = new Date().toISOString();
    const items: Record<string, unknown>[] = [];
    const last30 = "segments.date DURING LAST_30_DAYS";
    const pushItems = async (kind: string, query: string, map: (r: GaqlRow) => Record<string, unknown> | null) => {
      try {
        for (const r of await gaql(customerId, query)) {
          const row = map(r);
          if (row) items.push({ customer_id: customerId, kind, synced_at: runStart, ...readMetrics(r.metrics), ...row });
        }
      } catch (e) {
        errors.push(`${kind}: ${(e as Error).message}`);
      }
    };
    await Promise.all([
      pushItems(
        "ad_group",
        `SELECT ad_group.id, ad_group.name, ad_group.status, campaign.name, ${METRIC_FIELDS} FROM ad_group WHERE ${last30} AND ad_group.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 500`,
        (r) => ({ key: String(r.adGroup.id), label: r.adGroup.name ?? null, parent: r.campaign?.name ?? null, status: r.adGroup.status ?? null, extra: {} })
      ),
      pushItems(
        "keyword",
        `SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status,
                ad_group_criterion.quality_info.quality_score, ad_group.id, ad_group.name, campaign.name, ${METRIC_FIELDS}
         FROM keyword_view WHERE ${last30} AND ad_group_criterion.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 500`,
        (r) => ({
          key: `${r.adGroup.id}~${r.adGroupCriterion.criterionId}`,
          label: r.adGroupCriterion.keyword?.text ?? null,
          parent: r.campaign?.name ?? null,
          sub: r.adGroup?.name ?? null,
          status: r.adGroupCriterion.status ?? null,
          extra: { matchType: r.adGroupCriterion.keyword?.matchType ?? null, qualityScore: optNum(r.adGroupCriterion.qualityInfo?.qualityScore) },
        })
      ),
      pushItems(
        "search_term",
        `SELECT search_term_view.search_term, search_term_view.status, ad_group.id, ad_group.name, campaign.id, campaign.name, ${METRIC_FIELDS}
         FROM search_term_view WHERE ${last30} ORDER BY metrics.cost_micros DESC LIMIT 500`,
        (r) => ({
          key: `${r.campaign.id}~${r.adGroup.id}~${r.searchTermView.searchTerm}`,
          label: r.searchTermView.searchTerm ?? null,
          parent: r.campaign?.name ?? null,
          sub: r.adGroup?.name ?? null,
          status: r.searchTermView.status ?? null,
          extra: {},
        })
      ),
      pushItems(
        "ad",
        `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.ad.final_urls, ad_group_ad.ad_strength, ad_group_ad.status,
                ad_group_ad.policy_summary.approval_status, ad_group_ad.ad.responsive_search_ad.headlines, ad_group.id, ad_group.name, campaign.name, ${METRIC_FIELDS}
         FROM ad_group_ad WHERE ${last30} AND ad_group_ad.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 300`,
        (r) => {
          const ad = r.adGroupAd.ad;
          const headlines = ((ad.responsiveSearchAd?.headlines ?? []) as { text?: string }[]).map((h) => h.text).filter(Boolean).slice(0, 3);
          return {
            key: `${r.adGroup.id}~${ad.id}`,
            label: headlines.length ? headlines.join(" | ") : ad.name || ad.type || `Ad ${ad.id}`,
            parent: r.campaign?.name ?? null,
            sub: r.adGroup?.name ?? null,
            status: r.adGroupAd.status ?? null,
            extra: {
              type: ad.type ?? null,
              strength: r.adGroupAd.adStrength ?? null,
              approval: r.adGroupAd.policySummary?.approvalStatus ?? null,
              url: (ad.finalUrls ?? [])[0] ?? null,
            },
          };
        }
      ),
    ]);
    // Only swap the leaderboards when at least one section produced data,
    // so a failed report never wipes the previous good copy.
    if (items.length > 0) {
      await upsertChunks("google_ads_items", items.map((i) => ({ sub: null, ...i })), "customer_id,kind,key");
      const kinds = [...new Set(items.map((i) => i.kind as string))];
      for (const kind of kinds) {
        await db.from("google_ads_items").delete().eq("customer_id", customerId).eq("kind", kind).lt("synced_at", runStart);
      }
    }

    const firstDate = campaignDaily.map((r) => r.date as string).sort()[0] ?? null;
    await db.from("google_ads_accounts").upsert(
      {
        customer_id: customerId,
        name: info.name,
        currency: info.currency,
        time_zone: info.timeZone,
        is_manager: info.isManager,
        last_synced_at: new Date().toISOString(),
        last_error: errors.length ? errors.slice(0, 3).join(" · ").slice(0, 500) : null,
        ...(firstDate ? { first_data_date: firstDate } : {}),
      },
      { onConflict: "customer_id" }
    );

    return { customerId, name: info.name, campaignDays: campaignDaily.length, segments: segRows.length, items: items.length, errors };
  } catch (e) {
    const message = (e as Error).message;
    await db.from("google_ads_accounts").upsert({ customer_id: customerId, last_error: message.slice(0, 500) }, { onConflict: "customer_id" });
    throw e;
  }
}

// Accounts the daily cron keeps fresh: every brand-mapped account + any account
// a person has synced by hand before.
export async function syncTargets(): Promise<string[]> {
  if (!db) return [];
  const [clients, accounts] = await Promise.all([
    db.from("clients").select("google_ads_account_id").not("google_ads_account_id", "is", null),
    db.from("google_ads_accounts").select("customer_id,is_manager"),
  ]);
  const ids = new Set<string>();
  for (const c of clients.data ?? []) {
    const id = cleanCustomerId(c.google_ads_account_id);
    if (id) ids.add(id);
  }
  for (const a of accounts.data ?? []) if (!a.is_manager) ids.add(a.customer_id);
  return [...ids];
}

// Daily cron entry: 30 days re-pulled every night (conversions keep landing for
// weeks), and a first-time account gets a 180-day backfill.
export async function syncAllGoogleAccounts(): Promise<{ results: GoogleSyncResult[]; failures: { customerId: string; error: string }[] }> {
  const results: GoogleSyncResult[] = [];
  const failures: { customerId: string; error: string }[] = [];
  if (!googleConfigured() || !db) return { results, failures };

  for (const id of await syncTargets()) {
    try {
      const { data } = await db.from("google_ads_accounts").select("first_data_date").eq("customer_id", id).maybeSingle();
      results.push(await syncGoogleAccount(id, data?.first_data_date ? 30 : 180));
    } catch (e) {
      failures.push({ customerId: id, error: (e as Error).message });
    }
  }
  return { results, failures };
}
