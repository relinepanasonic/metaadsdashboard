// Aggregates Meta + Google datasets into the single payload the UI renders.
// This is the ONLY function the dashboard/API route needs to call.

import type {
  UnifiedDashboardData,
  KpiSummary,
  TimeseriesPoint,
  CampaignRow,
} from "./types";
import { fetchMetaAdsData } from "./metaAds";
import { fetchGoogleAdsData, GOOGLE_CONNECTED } from "./googleAds";
import type { DateRange } from "./metaCampaigns";
import { round } from "./mockUtils";

export type Platform = "meta" | "google" | "both";

function mergeKpis(a: KpiSummary, b: KpiSummary): KpiSummary {
  const totalSpend = a.totalSpend + b.totalSpend;
  const impressions = a.impressions + b.impressions;
  const clicks = a.clicks + b.clicks;
  const conversions = a.conversions + b.conversions;
  const leads = a.leads + b.leads;
  const revenue = a.revenue + b.revenue;
  return {
    totalSpend,
    impressions,
    clicks,
    conversions,
    leads,
    costPerLead: leads > 0 ? round(totalSpend / leads, 0) : 0,
    revenue,
    roas: revenue > 0 && totalSpend > 0 ? round(revenue / totalSpend, 2) : 0,
    ctr: round(clicks / impressions, 4),
    cpc: round(totalSpend / clicks, 0),
  };
}

function mergeTimeseries(
  a: TimeseriesPoint[],
  b: TimeseriesPoint[]
): TimeseriesPoint[] {
  const map = new Map<string, TimeseriesPoint>();
  for (const p of [...a, ...b]) {
    const existing = map.get(p.date);
    if (existing) {
      existing.spend = round(existing.spend + p.spend, 0);
      existing.revenue = round(existing.revenue + p.revenue, 0);
      existing.leads += p.leads;
    } else {
      map.set(p.date, { ...p });
    }
  }
  return Array.from(map.values()).sort((x, y) => x.date.localeCompare(y.date));
}

interface DashboardOptions {
  accountIds?: string[]; // Meta ad accounts to include (role-scoped)
  range?: DateRange;
  clientFilter?: string; // only campaigns resolved to this client
  platform?: Platform; // "meta" | "google" | "both" (default "both")
}

// No mock data — Meta is skipped if platform === "google", Google is only
// included when platform !== "meta" AND it's actually connected.
export async function getUnifiedDashboardData(opts: DashboardOptions = {}): Promise<UnifiedDashboardData> {
  const { accountIds, range, clientFilter, platform = "both" } = opts;

  const wantMeta = platform !== "google";
  const wantGoogle = platform !== "meta" && GOOGLE_CONNECTED;

  const meta = wantMeta ? await fetchMetaAdsData(accountIds, range, clientFilter) : null;
  const google = wantGoogle ? await fetchGoogleAdsData() : null;

  if (!meta && !google) {
    throw new Error(
      platform === "google" ? "Google Ads not connected." : "Meta Ads not connected — set META_ACCESS_TOKEN."
    );
  }

  // --- Single-platform view ---
  if (!meta || !google) {
    const only = meta ?? google!;
    const sources = only.campaigns
      .slice()
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5)
      .map((c) => ({ platform: only.platform, label: c.name, spend: c.spend }));

    const topCampaigns = only.campaigns
      .slice()
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 6);

    return {
      kpis: only.kpis,
      timeseries: only.timeseries,
      sources,
      topCampaigns,
      perPlatform: [only],
      generatedAt: new Date().toISOString(),
    };
  }

  // --- Combined Meta + Google view ---
  const kpis = mergeKpis(meta.kpis, google.kpis);
  const timeseries = mergeTimeseries(meta.timeseries, google.timeseries);

  const sources = [
    { platform: "meta" as const, label: "Meta Ads", spend: meta.kpis.totalSpend },
    { platform: "google" as const, label: "Google Ads", spend: google.kpis.totalSpend },
  ];

  const topCampaigns: CampaignRow[] = [...meta.campaigns, ...google.campaigns]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 6);

  return {
    kpis,
    timeseries,
    sources,
    topCampaigns,
    perPlatform: [meta, google],
    generatedAt: new Date().toISOString(),
  };
}
