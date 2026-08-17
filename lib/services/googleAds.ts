// ============================================================================
// GOOGLE ADS SERVICE
// ----------------------------------------------------------------------------
// Currently returns MOCK data. To go live, replace the body of
// `fetchGoogleAdsData()` with the Google Ads Node.js SDK (google-ads-api).
// Keep the return type (PlatformDataset) identical so the UI is untouched.
//
// Real implementation sketch (for later):
//
//   import { GoogleAdsApi } from "google-ads-api";
//   const client = new GoogleAdsApi({
//     client_id: process.env.GOOGLE_CLIENT_ID!,
//     client_secret: process.env.GOOGLE_CLIENT_SECRET!,
//     developer_token: process.env.GOOGLE_DEVELOPER_TOKEN!,
//   });
//   const customer = client.Customer({
//     customer_id: process.env.GOOGLE_CUSTOMER_ID!,
//     refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
//   });
//   const rows = await customer.report({ ... });
//   ...map rows -> PlatformDataset...
// ============================================================================

import type { PlatformDataset, TimeseriesPoint, CampaignRow } from "./types";
import { seededRandom, lastNDates, delay, round } from "./mockUtils";

const GOOGLE_CAMPAIGN_NAMES = [
  "Search — Jasa Optimasi Toko",
  "Search — Iklan Shopee Boncos",
  "Performance Max — Ecommerce",
  "YouTube — Brand Awareness",
  "Display — Retargeting",
];

function buildGoogleMock(): PlatformDataset {
  const rand = seededRandom(1337);
  const dates = lastNDates(30);

  const timeseries: TimeseriesPoint[] = dates.map((date, i) => {
    const base = 260000 + Math.cos(i / 4) * 70000 + rand() * 90000;
    const spend = round(base, 0);
    const revenue = round(spend * (2.0 + rand() * 1.3), 0);
    return { date, spend, revenue };
  });

  const totalSpend = timeseries.reduce((a, p) => a + p.spend, 0);
  const totalRevenue = timeseries.reduce((a, p) => a + p.revenue, 0);
  const impressions = Math.round(totalSpend / 18);
  const clicks = Math.round(impressions * 0.045);
  const conversions = Math.round(clicks * 0.12);

  const campaigns: CampaignRow[] = GOOGLE_CAMPAIGN_NAMES.map((name, i) => {
    const spend = round((totalSpend / 5) * (0.6 + rand()), 0);
    const roas = round(1.8 + rand() * 2.0, 2);
    return {
      id: `google-${i + 1}`,
      name,
      platform: "google",
      spend,
      revenue: round(spend * roas, 0),
      roas,
      conversions: Math.round(spend / 16000),
    };
  });

  return {
    platform: "google",
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

export async function fetchGoogleAdsData(): Promise<PlatformDataset> {
  // MOCK: swap this line for a real Google Ads SDK call when keys are ready.
  return delay(buildGoogleMock(), 550);
}
