// ============================================================================
// META ADS SERVICE  — LIVE via Meta Graph API (Marketing API insights)
// ----------------------------------------------------------------------------
// If META_ACCESS_TOKEN is set, this fetches real data from the Graph API.
// If it's missing (e.g. local dev without secrets), it falls back to mock data
// so the app never breaks. Return type stays PlatformDataset either way.
//
// Env vars (server-side only — never NEXT_PUBLIC):
//   META_ACCESS_TOKEN     System User token with ads_read
//   META_AD_ACCOUNT_ID    numeric id, e.g. 1153490826516966
//   META_API_VERSION      optional, defaults to v21.0
// ============================================================================

import type { PlatformDataset, TimeseriesPoint, CampaignRow } from "./types";
import { seededRandom, lastNDates, delay, round } from "./mockUtils";

const TOKEN = process.env.META_ACCESS_TOKEN;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID || "1153490826516966";
const VERSION = process.env.META_API_VERSION || "v21.0";
const BASE = `https://graph.facebook.com/${VERSION}`;

// --- Graph API response shapes (only the fields we request) ---------------
interface MetaAction {
  action_type: string;
  value: string;
}
interface MetaInsightRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  reach?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  date_start?: string;
  date_stop?: string;
  campaign_id?: string;
  campaign_name?: string;
}

// Sum the value of the first matching action type (in priority order).
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
// Purchase value (revenue) — usually 0 for lead-gen accounts.
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

async function fetchLive(): Promise<PlatformDataset> {
  // 1) Daily account insights → timeseries + aggregate KPIs
  const daily = await graphGet(`act_${ACCOUNT}/insights`, {
    fields: "spend,impressions,clicks,ctr,cpc,reach,actions,action_values",
    date_preset: "last_30d",
    time_increment: "1",
    level: "account",
  });

  const timeseries: TimeseriesPoint[] = daily.map((r) => ({
    date: r.date_start ?? "",
    spend: round(Number(r.spend) || 0, 0),
    revenue: round(actionValue(r.action_values, PURCHASE_VALUE_TYPES), 0),
  }));

  const totalSpend = daily.reduce((a, r) => a + (Number(r.spend) || 0), 0);
  const impressions = daily.reduce((a, r) => a + (Number(r.impressions) || 0), 0);
  const clicks = daily.reduce((a, r) => a + (Number(r.clicks) || 0), 0);
  const conversions = daily.reduce((a, r) => a + actionValue(r.actions, CONVERSATION_TYPES), 0);
  const revenue = timeseries.reduce((a, p) => a + p.revenue, 0);

  // 2) Campaign-level insights → top campaigns
  const campaignRows = await graphGet(`act_${ACCOUNT}/insights`, {
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
        // For lead-gen (no revenue), rank by conversions*spend proxy so bars aren't all 0.
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
      revenue: round(revenue, 0),
      roas: revenue > 0 && totalSpend > 0 ? round(revenue / totalSpend, 2) : 0,
      ctr: impressions > 0 ? round(clicks / impressions, 4) : 0,
      cpc: clicks > 0 ? round(totalSpend / clicks, 0) : 0,
    },
    timeseries,
    campaigns,
  };
}

// --------------------------- MOCK FALLBACK --------------------------------
const META_CAMPAIGN_NAMES = [
  "WA Leads — Broad AI",
  "WA Leads — Seller Interest",
  "Retargeting 30d Warm",
  "Live Shopping Promo",
  "Audit Gratis — Cold",
];

function buildMetaMock(): PlatformDataset {
  const rand = seededRandom(42);
  const dates = lastNDates(30);
  const timeseries: TimeseriesPoint[] = dates.map((date, i) => {
    const base = 380000 + Math.sin(i / 3) * 90000 + rand() * 120000;
    const spend = round(base, 0);
    const revenue = round(spend * (2.4 + rand() * 1.6), 0);
    return { date, spend, revenue };
  });
  const totalSpend = timeseries.reduce((a, p) => a + p.spend, 0);
  const totalRevenue = timeseries.reduce((a, p) => a + p.revenue, 0);
  const impressions = Math.round(totalSpend / 22);
  const clicks = Math.round(impressions * 0.031);
  const conversions = Math.round(clicks * 0.18);
  const campaigns: CampaignRow[] = META_CAMPAIGN_NAMES.map((name, i) => {
    const spend = round((totalSpend / 5) * (0.6 + rand()), 0);
    const roas = round(2.1 + rand() * 2.2, 2);
    return { id: `meta-${i + 1}`, name, platform: "meta", spend, revenue: round(spend * roas, 0), roas, conversions: Math.round(spend / 14000) };
  });
  return {
    platform: "meta",
    kpis: {
      totalSpend, impressions, clicks, conversions, revenue: totalRevenue,
      roas: round(totalRevenue / totalSpend, 2),
      ctr: round(clicks / impressions, 4),
      cpc: round(totalSpend / clicks, 0),
    },
    timeseries, campaigns,
  };
}

export async function fetchMetaAdsData(): Promise<PlatformDataset> {
  if (!TOKEN) {
    // No token configured — safe mock fallback.
    return delay(buildMetaMock(), 450);
  }
  try {
    return await fetchLive();
  } catch (err) {
    console.error("[metaAds] live fetch failed, using mock:", (err as Error).message);
    return buildMetaMock();
  }
}
