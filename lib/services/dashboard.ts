// Aggregates Meta + Google datasets into the single payload the UI renders.
// This is the ONLY function the dashboard/API route needs to call.

import type {
  UnifiedDashboardData,
  KpiSummary,
  TimeseriesPoint,
  CampaignRow,
} from "./types";
import { fetchMetaAdsData } from "./metaAds";
import { fetchGoogleAdsData } from "./googleAds";
import { round } from "./mockUtils";

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

// Google Ads is mock-only for now, so it's OFF by default to avoid distorting
// the real Meta numbers. Set ENABLE_GOOGLE_ADS=true once Google is really connected.
const ENABLE_GOOGLE = process.env.ENABLE_GOOGLE_ADS === "true";

export async function getUnifiedDashboardData(): Promise<UnifiedDashboardData> {
  const meta = await fetchMetaAdsData();
  const google = ENABLE_GOOGLE ? await fetchGoogleAdsData() : null;

  // --- Meta-only view (default) ---
  if (!google) {
    const sources = meta.campaigns
      .slice()
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5)
      .map((c) => ({ platform: "meta" as const, label: c.name, spend: c.spend }));

    const topCampaigns = meta.campaigns
      .slice()
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 6);

    return {
      kpis: meta.kpis,
      timeseries: meta.timeseries,
      sources,
      topCampaigns,
      perPlatform: [meta],
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
