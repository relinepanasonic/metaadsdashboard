// Shared types for both Meta Ads and Google Ads services.
// Keep these stable — the real API adapters must return these same shapes
// so the UI never needs to change when you swap mock data for live data.

export type AdPlatform = "meta" | "google";

export interface KpiSummary {
  totalSpend: number; // in account currency (IDR)
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number; // messaging conversations / lead-form submissions
  costPerLead: number; // spend / leads
  revenue: number; // purchase value (0 for lead-gen accounts)
  roas: number; // revenue / spend
  ctr: number; // clicks / impressions (0..1)
  cpc: number; // spend / clicks
}

export interface TimeseriesPoint {
  date: string; // YYYY-MM-DD
  spend: number;
  revenue: number;
  leads: number;
}

export interface SourceSlice {
  platform: AdPlatform;
  label: string;
  spend: number;
}

export interface CampaignRow {
  id: string;
  name: string;
  platform: AdPlatform;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
}

export interface PlatformDataset {
  platform: AdPlatform;
  kpis: KpiSummary;
  timeseries: TimeseriesPoint[];
  campaigns: CampaignRow[];
}

// The unified payload the dashboard consumes.
export interface UnifiedDashboardData {
  kpis: KpiSummary; // combined across platforms
  timeseries: TimeseriesPoint[]; // combined per day
  sources: SourceSlice[]; // spend split by platform
  topCampaigns: CampaignRow[]; // best campaigns across both platforms
  perPlatform: PlatformDataset[];
  generatedAt: string;
}
