// ============================================================================
// META ADS SERVICE  — LIVE ONLY (Meta Graph API / Marketing API insights)
// ----------------------------------------------------------------------------
// No mock data. If the token is missing or the API fails, this throws — the
// dashboard then shows a "not connected" state instead of fake numbers.
//
// Env vars (server-side only — never NEXT_PUBLIC):
//   META_ACCESS_TOKEN     System User token with ads_read
//   META_AD_ACCOUNT_ID    default account id, e.g. 1153490826516966
//   META_API_VERSION      optional, defaults to v21.0
// ============================================================================

import type { PlatformDataset, TimeseriesPoint, CampaignRow } from "./types";
import { round } from "./mockUtils";

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

// Fetch + shape data for a single ad account.
async function fetchForAccount(accountId: string): Promise<PlatformDataset> {
  const daily = await graphGet(`act_${accountId}/insights`, {
    fields: "spend,impressions,clicks,actions,action_values",
    date_preset: "last_30d",
    time_increment: "1",
    level: "account",
  });

  const timeseries: TimeseriesPoint[] = daily.map((r) => ({
    date: r.date_start ?? "",
    spend: round(Number(r.spend) || 0, 0),
    revenue: round(actionValue(r.action_values, PURCHASE_VALUE_TYPES), 0),
    leads: Math.round(actionValue(r.actions, CONVERSATION_TYPES)),
  }));

  const totalSpend = daily.reduce((a, r) => a + (Number(r.spend) || 0), 0);
  const impressions = daily.reduce((a, r) => a + (Number(r.impressions) || 0), 0);
  const clicks = daily.reduce((a, r) => a + (Number(r.clicks) || 0), 0);
  const conversions = daily.reduce((a, r) => a + actionValue(r.actions, CONVERSATION_TYPES), 0);
  const revenue = timeseries.reduce((a, p) => a + p.revenue, 0);
  const leads = conversions;

  const campaignRows = await graphGet(`act_${accountId}/insights`, {
    fields: "campaign_id,campaign_name,spend,actions,action_values",
    date_preset: "last_30d",
    level: "campaign",
    limit: "50",
  });

  const campaigns: CampaignRow[] = campaignRows
    .map((r) => {
      const spend = round(Number(r.spend) || 0, 0);
      const rev = round(actionValue(r.action_values, PURCHASE_VALUE_TYPES), 0);
      const conv = actionValue(r.actions, CONVERSATION_TYPES);
      return {
        id: r.campaign_id ?? r.campaign_name ?? Math.random().toString(36),
        name: r.campaign_name ?? "Untitled",
        platform: "meta" as const,
        spend,
        revenue: rev > 0 ? rev : conv,
        roas: rev > 0 && spend > 0 ? round(rev / spend, 2) : 0,
        conversions: conv,
      };
    })
    .filter((c) => c.spend > 0);

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

// accountIds: which ad accounts to combine. Defaults to the single main
// account for backwards compatibility. Pass the caller's scoped list to
// respect role-based access (Superadmin = all, Advertiser = assigned).
export async function fetchMetaAdsData(accountIds: string[] = [DEFAULT_ACCOUNT]): Promise<PlatformDataset> {
  if (!TOKEN) {
    throw new Error("Meta Ads not connected — set META_ACCESS_TOKEN.");
  }
  if (accountIds.length === 0) {
    throw new Error("No ad accounts assigned to this user yet.");
  }
  const sets = await Promise.all(accountIds.map(fetchForAccount));
  return mergeDatasets(sets);
}
