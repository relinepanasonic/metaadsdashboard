// ============================================================================
// META ADS SERVICE
// ----------------------------------------------------------------------------
// Currently returns MOCK data. To go live, replace the body of
// `fetchMetaAdsData()` with a real Meta Graph API call. The function signature
// and return type (PlatformDataset) must stay the same so the UI keeps working.
//
// Real implementation sketch (for later):
//
//   const res = await fetch(
//     `https://graph.facebook.com/v21.0/act_${ACCOUNT_ID}/insights` +
//     `?fields=spend,impressions,clicks,actions,action_values` +
//     `&date_preset=last_30d&time_increment=1` +
//     `&access_token=${process.env.META_ACCESS_TOKEN}`
//   );
//   const json = await res.json();
//   ...map json.data -> PlatformDataset...
// ============================================================================

import type { PlatformDataset, TimeseriesPoint, CampaignRow } from "./types";
import { seededRandom, lastNDates, delay, round } from "./mockUtils";

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
  const impressions = Math.round(totalSpend / 22); // ~IDR22 CPM-ish
  const clicks = Math.round(impressions * 0.031);
  const conversions = Math.round(clicks * 0.18);

  const campaigns: CampaignRow[] = META_CAMPAIGN_NAMES.map((name, i) => {
    const spend = round((totalSpend / 5) * (0.6 + rand()), 0);
    const roas = round(2.1 + rand() * 2.2, 2);
    return {
      id: `meta-${i + 1}`,
      name,
      platform: "meta",
      spend,
      revenue: round(spend * roas, 0),
      roas,
      conversions: Math.round(spend / 14000),
    };
  });

  return {
    platform: "meta",
    kpis: {
      totalSpend,
      impressions,
      clicks,
      conversions,
      revenue: totalRevenue,
      roas: round(totalRevenue / totalSpend, 2),
      ctr: round(clicks / impressions, 4),
      cpc: round(totalSpend / clicks, 0),
    },
    timeseries,
    campaigns,
  };
}

export async function fetchMetaAdsData(): Promise<PlatformDataset> {
  // MOCK: swap this line for a real Graph API fetch when keys are ready.
  return delay(buildMetaMock(), 450);
}
