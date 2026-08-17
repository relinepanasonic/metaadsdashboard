// ============================================================================
// META CAMPAIGNS  — live campaign table data for the Meta Ads page
// ============================================================================

import type { MetaAccount, CampaignTableRow } from "./types";
import { resolveClient } from "../clientMap";
import { round } from "./mockUtils";
import { db } from "../supabase/db";

// Load manual campaign->client overrides from Supabase (if configured).
async function loadClientOverrides(accountId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!db) return map;
  try {
    const { data } = await db
      .from("campaign_clients")
      .select("campaign_id,client_name")
      .eq("ad_account_id", accountId);
    for (const row of data ?? []) map.set(row.campaign_id, row.client_name);
  } catch {
    // table may not exist yet — fall back to keyword inference
  }
  return map;
}

const TOKEN = process.env.META_ACCESS_TOKEN;
const VERSION = process.env.META_API_VERSION || "v21.0";
const BASE = `https://graph.facebook.com/${VERSION}`;

// Ad accounts this token can read. Add ids here as more are granted access.
const ACCOUNT_IDS = (process.env.META_AD_ACCOUNT_IDS ||
  "1153490826516966,1577569293165066,1228774344982974,1330160865464929")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const META_CONNECTED = Boolean(TOKEN);

interface MetaAction {
  action_type: string;
  value: string;
}

function actionValue(actions: MetaAction[] | undefined, types: string[]): number {
  if (!actions) return 0;
  for (const t of types) {
    const hit = actions.find((a) => a.action_type === t);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const usp = new URLSearchParams({ ...params, access_token: TOKEN! });
  const res = await fetch(`${BASE}/${path}?${usp.toString()}`, { next: { revalidate: 120 } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta API ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// --- Accounts (for the Ad Account / Business filters) ----------------------
export async function fetchMetaAccounts(): Promise<MetaAccount[]> {
  if (!TOKEN) throw new Error("Meta Ads not connected — set META_ACCESS_TOKEN.");
  const results = await Promise.all(
    ACCOUNT_IDS.map(async (id) => {
      try {
        const r = await graph<{ name?: string; business?: { name?: string } }>(`act_${id}`, {
          fields: "name,business{name}",
        });
        return { id, name: r.name ?? `act_${id}`, business: r.business?.name ?? "" };
      } catch {
        return null; // skip accounts the token can't read
      }
    })
  );
  return results.filter((a): a is MetaAccount => a !== null);
}

// --- Result label + value based on objective -------------------------------
function computeResult(objective: string, actions: MetaAction[] | undefined): { value: number; label: string } {
  const get = (t: string) => actionValue(actions, [t]);
  const messaging =
    get("onsite_conversion.messaging_conversation_started_7d") ||
    get("onsite_conversion.total_messaging_connection");

  switch (objective) {
    case "OUTCOME_LEADS": {
      if (messaging) return { value: messaging, label: "Messaging conversations" };
      const lead = get("lead");
      return { value: lead, label: "Leads" };
    }
    case "OUTCOME_ENGAGEMENT": {
      if (messaging) return { value: messaging, label: "Messaging conversations" };
      return { value: get("post_engagement"), label: "Post engagements" };
    }
    case "OUTCOME_TRAFFIC": {
      const lpv = get("landing_page_view") || get("omni_landing_page_view");
      if (lpv) return { value: lpv, label: "Landing page views" };
      return { value: get("link_click"), label: "Link clicks" };
    }
    case "OUTCOME_SALES":
      return { value: get("omni_purchase") || get("purchase"), label: "Purchases" };
    default: {
      if (messaging) return { value: messaging, label: "Messaging conversations" };
      return { value: get("link_click"), label: "Link clicks" };
    }
  }
}

function deliveryLabel(effectiveStatus: string): string {
  switch (effectiveStatus) {
    case "ACTIVE":
      return "Active";
    case "IN_PROCESS":
    case "PENDING_REVIEW":
      return "In review";
    case "WITH_ISSUES":
      return "Issues";
    case "PAUSED":
    case "CAMPAIGN_PAUSED":
    case "ADSET_PAUSED":
      return "Off";
    default:
      return effectiveStatus.charAt(0) + effectiveStatus.slice(1).toLowerCase().replace(/_/g, " ");
  }
}

// --- Campaign table for one account ----------------------------------------
interface CampaignObj {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
}
interface InsightObj {
  campaign_id?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  actions?: MetaAction[];
}

export async function fetchMetaCampaigns(accountId: string): Promise<CampaignTableRow[]> {
  if (!TOKEN) throw new Error("Meta Ads not connected — set META_ACCESS_TOKEN.");

  const [campaignsRes, insightsRes, overrides] = await Promise.all([
    graph<{ data: CampaignObj[] }>(`act_${accountId}/campaigns`, {
      fields: "name,status,effective_status,objective,daily_budget,lifetime_budget",
      limit: "200",
    }),
    graph<{ data: InsightObj[] }>(`act_${accountId}/insights`, {
      fields: "campaign_id,spend,impressions,reach,actions",
      level: "campaign",
      date_preset: "last_30d",
      limit: "200",
    }),
    loadClientOverrides(accountId),
  ]);

  const metrics = new Map<string, InsightObj>();
  for (const row of insightsRes.data) {
    if (row.campaign_id) metrics.set(row.campaign_id, row);
  }

  return campaignsRes.data.map((c) => {
    const m = metrics.get(c.id);
    const spend = round(Number(m?.spend) || 0, 0);
    const { value: results, label: resultLabel } = computeResult(c.objective, m?.actions);
    return {
      id: c.id,
      client: overrides.get(c.id) ?? resolveClient(c.name),
      name: c.name,
      status: c.status,
      delivery: deliveryLabel(c.effective_status),
      objective: c.objective,
      resultLabel,
      results,
      costPerResult: results > 0 ? round(spend / results, 0) : 0,
      dailyBudget: round(Number(c.daily_budget) || 0, 0),
      lifetimeBudget: round(Number(c.lifetime_budget) || 0, 0),
      spend,
      impressions: Number(m?.impressions) || 0,
      reach: Number(m?.reach) || 0,
    };
  });
}
