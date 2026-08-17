// ============================================================================
// GOOGLE ADS SERVICE  — NOT CONNECTED YET
// ----------------------------------------------------------------------------
// No mock data. Google Ads is not connected. When you're ready to go live,
// implement fetchGoogleAdsData() with the google-ads-api Node SDK and return
// a PlatformDataset (same shape as Meta), then set ENABLE_GOOGLE_ADS=true.
//
// Real implementation sketch (for later):
//   import { GoogleAdsApi } from "google-ads-api";
//   const client = new GoogleAdsApi({ client_id, client_secret, developer_token });
//   const customer = client.Customer({ customer_id, refresh_token });
//   const rows = await customer.report({ ... });
//   ...map rows -> PlatformDataset...
// ============================================================================

import type { PlatformDataset } from "./types";

export const GOOGLE_CONNECTED = Boolean(process.env.GOOGLE_ADS_REFRESH_TOKEN);

export async function fetchGoogleAdsData(): Promise<PlatformDataset> {
  throw new Error("Google Ads not connected yet.");
}
