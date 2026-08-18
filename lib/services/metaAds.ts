// ============================================================================
// META ADS SERVICE  — LIVE ONLY (Meta Graph API / Marketing API insights)
// ----------------------------------------------------------------------------
// No mock data. If the token is missing or the API fails, this throws — the
// dashboard then shows a "not connected" state instead of fake numbers.
//
// Always fetches at campaign+daily granularity (level=campaign, time_increment=1)
// so a client filter can be applied consistently to both the KPI totals and the
// day-by-day chart, not just the campaign list.
//
// Env vars (server-side only — never NEXT_PUBLIC):
//   META_ACCESS_TOKEN     System User token with ads_read
//   META_AD_ACCOUNT_ID    default account id, e.g. 1153490826516966
//   META_API_VERSION      optional, defaults to v21.0
// ============================================================================

import type { PlatformDataset, TimeseriesPoint, CampaignRow } from "./types";
import { round } from "./mockUtils";
import { resolveClient } from "../clientMap";
import { loadClientOverrides, type DateRange } from "./metaCampaigns";

const TOKEN = process.env.META_ACCESS_TOKEN;
const DEFAULT_ACCOUNT = process.env.META_AD_ACCOUNT_ID || "1153490826516966";
const VERSION = process.env.META_API_VERSION || "v21.0";
const BASE = `https://graph.facebook.com/${VERSION}`;

export const META_CONNECTED = Boolean(TOKEN);

interface MetaAction {
  action_type: string;
  value: string;
}
interface MetaInsightRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  date_start?: string;
  campaign_id?: string;
  campaign_name?: string;
}

function actionValue(actions: MetaAction[] | undefined, types: string[]): number {
  if (!actions) return 0;
  for (const t of types) {
    const hit = actions.find((a) => a.action_type === t);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

// Leads for a WA/messaging business = conversations started.
const CONVERSATION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
  "lead",
];
const PURCHASE_VALUE_TYPES = ["omni_purchase", "purchase"];

function dateParams(range?: DateRange): Record<string, string> {
  if (range?.since && range?.until) {
    return { time_range: JSON.stringify({ since: range.since, until: range.until }) };
  }
  return { date_preset: range?.preset || "last_30d" };
}

async function graphGet(path: string, params: Record<string, string>): Promise<MetaInsightRow[]> {
  const usp = new URLSearchParams({ ...params, access_token: TOKEN! });
  const res = await fetch(`${BASE}/${path}?${usp.toString()}`, {
    next: { revalidate: 300 }, // cache 5 min
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta API ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: MetaInsightRow[] };
  return json.data ?? [];
}

// Fetch + shape data for a single ad account, optionally scoped to one client.
async function fetchForAccount(accountId: string, range?: DateRange, clientFilter?: string): Promise<PlatformDataset> {
  const [rows, overrides] = await Promise.all([
    graphGet(`act_${accountId}/insights`, {
      fields: "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values",
      level: "campaign",
      time_increment: "1",
      limit: "500",
      ...dateParams(range),
    }),
    loadClientOverrides(accountId),
  ]);

  const clientOf = (id: string, name: string) => overrides.get(id) ?? resolveClient(name);
  const rowsInScope = clientFilter
    ? rows.filter((r) => clientOf(r.campaign_id ?? "", r.campaign_name ?? "") === clientFilter)
    : rows;

  // Daily timeseries (sum across campaigns per date).
  const tsMap = new Map<string, TimeseriesPoint>();
  for (const r of rowsInScope) {
    const date = r.date_start ?? "";
    const spend = round(Number(r.spend) || 0, 0);
    const leads = Math.round(actionValue(r.actions, CONVERSATION_TYPES));
    const revenue = round(actionValue(r.action_values, PURCHASE_VALUE_TYPES), 0);
    const existing = tsMap.get(date);
    if (existing) {
      existing.spend = round(existing.spend + spend, 0);
      existing.leads += leads;
      existing.revenue = round(existing.revenue + revenue, 0);
    } else {
      tsMap.set(date, { date, spend, leads, revenue });
    }
  }
  const timeseries = Array.from(tsMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Per-campaign totals (sum across days per campaign) for the KPI cards + top campaigns.
  interface CampaignAgg { name: string; spend: number; impressions: number; clicks: number; leads: number; revenue: number }
  const byCampaign = new Map<string, CampaignAgg>();
  for (const r of rowsInScope) {
    const id = r.campaign_id ?? r.campaign_name ?? "unknown";
    const agg = byCampaign.get(id) ?? { name: r.campaign_name ?? "Untitled", spend: 0, impressions: 0, clicks: 0, leads: 0, revenue: 0 };
    agg.spend += Number(r.spend) || 0;
    agg.impressions += Number(r.impressions) || 0;
    agg.clicks += Number(r.clicks) || 0;
    agg.leads += actionValue(r.actions, CONVERSATION_TYPES);
    agg.revenue += actionValue(r.action_values, PURCHASE_VALUE_TYPES);
    byCampaign.set(id, agg);
  }

  const campaigns: CampaignRow[] = Array.from(byCampaign.entries())
    .map(([id, c]) => ({
      id,
      name: c.name,
      platform: "meta" as const,
      spend: round(c.spend, 0),
      revenue: c.revenue > 0 ? round(c.revenue, 0) : Math.round(c.leads),
      roas: c.revenue > 0 && c.spend > 0 ? round(c.revenue / c.spend, 2) : 0,
      conversions: Math.round(c.leads),
    }))
    .filter((c) => c.spend > 0);

  const totals = Array.from(byCampaign.values()).reduce(
    (a, c) => ({
      spend: a.spend + c.spend,
      impressions: a.impressions + c.impressions,
      clicks: a.clicks + c.clicks,
      leads: a.leads + c.leads,
      revenue: a.revenue + c.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0, revenue: 0 }
  );

  return {
    platform: "meta",
    kpis: {
      totalSpend: round(totals.spend, 0),
      impressions: totals.impressions,
      clicks: totals.clicks,
      conversions: Math.round(totals.leads),
      leads: Math.round(totals.leads),
      costPerLead: totals.leads > 0 ? round(totals.spend / totals.leads, 0) : 0,
      revenue: round(totals.revenue, 0),
      roas: totals.revenue > 0 && totals.spend > 0 ? round(totals.revenue / totals.spend, 2) : 0,
      ctr: totals.impressions > 0 ? round(totals.clicks / totals.impressions, 4) : 0,
      cpc: totals.clicks > 0 ? round(totals.spend / totals.clicks, 0) : 0,
    },
    timeseries,
    campaigns,
  };
}

function mergeDatasets(sets: PlatformDataset[]): PlatformDataset {
  if (sets.length === 1) return sets[0];

  const totalSpend = sets.reduce((a, s) => a + s.kpis.totalSpend, 0);
  const impressions = sets.reduce((a, s) => a + s.kpis.impressions, 0);
  const clicks = sets.reduce((a, s) => a + s.kpis.clicks, 0);
  const conversions = sets.reduce((a, s) => a + s.kpis.conversions, 0);
  const leads = sets.reduce((a, s) => a + s.kpis.leads, 0);
  const revenue = sets.reduce((a, s) => a + s.kpis.revenue, 0);

  const tsMap = new Map<string, TimeseriesPoint>();
  for (const s of sets) {
    for (const p of s.timeseries) {
      const existing = tsMap.get(p.date);
      if (existing) {
        existing.spend = round(existing.spend + p.spend, 0);
        existing.revenue = round(existing.revenue + p.revenue, 0);
        existing.leads += p.leads;
      } else {
        tsMap.set(p.date, { ...p });
      }
    }
  }

  return {
    platform: "meta",
    kpis: {
      totalSpend: round(totalSpend, 0),
      impressions,
      clicks,
      conversions,
      leads,
      costPerLead: leads > 0 ? round(totalSpend / leads, 0) : 0,
      revenue: round(revenue, 0),
      roas: revenue > 0 && totalSpend > 0 ? round(revenue / totalSpend, 2) : 0,
      ctr: impressions > 0 ? round(clicks / impressions, 4) : 0,
      cpc: clicks > 0 ? round(totalSpend / clicks, 0) : 0,
    },
    timeseries: Array.from(tsMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    campaigns: sets.flatMap((s) => s.campaigns),
  };
}

// accountIds: which ad accounts to combine (role-scoped by the caller).
// range: Meta date_preset or a custom since/until pair.
// clientFilter: when set, only campaigns resolved to this client are included.
export async function fetchMetaAdsData(
  accountIds: string[] = [DEFAULT_ACCOUNT],
  range?: DateRange,
  clientFilter?: string
): Promise<PlatformDataset> {
  if (!TOKEN) {
    throw new Error("Meta Ads not connected — set META_ACCESS_TOKEN.");
  }
  if (accountIds.length === 0) {
    throw new Error("No ad accounts assigned to this user yet.");
  }
  const sets = await Promise.all(accountIds.map((id) => fetchForAccount(id, range, clientFilter)));
  return mergeDatasets(sets);
}
