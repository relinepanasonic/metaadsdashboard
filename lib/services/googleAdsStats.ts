// Reads the google_ads_* tables and shapes them for the dashboard: totals with
// a previous-period comparison, daily series, campaign / segment tables,
// leaderboards and the rule-based "what should I do" insights.

import { db } from "@/lib/supabase/db";
import { jakartaToday } from "./googleAds";
import type { PlatformDataset } from "./types";

export interface DateRangeInput {
  preset?: string;
  since?: string;
  until?: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (d: Date, days: number) => {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;

// Same preset names as the shared DateRangePicker.
export function resolveRange(r: DateRangeInput): { since: string; until: string } {
  if (r.since && r.until) return { since: r.since, until: r.until };
  const today = jakartaToday();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const dow = (today.getUTCDay() + 6) % 7; // Monday = 0
  const last = (n: number) => ({ since: iso(shift(today, -(n - 1))), until: iso(today) });

  switch (r.preset) {
    case "today": return { since: iso(today), until: iso(today) };
    case "yesterday": return { since: iso(shift(today, -1)), until: iso(shift(today, -1)) };
    case "last_7d": return last(7);
    case "last_14d": return last(14);
    case "last_28d": return last(28);
    case "last_90d": return last(90);
    case "this_week_mon_today": return { since: iso(shift(today, -dow)), until: iso(today) };
    case "last_week_mon_sun": return { since: iso(shift(today, -dow - 7)), until: iso(shift(today, -dow - 1)) };
    case "this_month": return { since: iso(new Date(Date.UTC(y, m, 1))), until: iso(today) };
    case "last_month": return { since: iso(new Date(Date.UTC(y, m - 1, 1))), until: iso(new Date(Date.UTC(y, m, 0))) };
    case "this_quarter": return { since: iso(new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1))), until: iso(today) };
    case "last_quarter": {
      const qs = Math.floor(m / 3) * 3 - 3;
      return { since: iso(new Date(Date.UTC(y, qs, 1))), until: iso(new Date(Date.UTC(y, qs + 3, 0))) };
    }
    case "this_year": return { since: `${y}-01-01`, until: iso(today) };
    case "last_year": return { since: `${y - 1}-01-01`, until: `${y - 1}-12-31` };
    case "maximum": return { since: "2000-01-01", until: iso(today) };
    default: return last(30);
  }
}

export interface Totals {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  convValue: number;
}
const zero = (): Totals => ({ impressions: 0, clicks: 0, cost: 0, conversions: 0, convValue: 0 });
const add = (t: Totals, r: { impressions: number | string; clicks: number | string; cost: number | string; conversions: number | string; conv_value: number | string }) => {
  t.impressions += Number(r.impressions);
  t.clicks += Number(r.clicks);
  t.cost += Number(r.cost);
  t.conversions += Number(r.conversions);
  t.convValue += Number(r.conv_value);
};

// PostgREST caps responses at 1000 rows — read in pages.
async function fetchAll<T>(make: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

interface CampDailyRow {
  campaign_id: string; date: string; campaign_name: string | null; status: string | null; channel_type: string | null; bidding: string | null;
  budget: number | null; impressions: number; clicks: number; cost: number; conversions: number; conv_value: number;
  search_is: number | null; lost_is_budget: number | null; lost_is_rank: number | null;
}
interface SegRow { date: string; dimension: string; key: string; impressions: number; clicks: number; cost: number; conversions: number; conv_value: number }
interface ItemRow {
  kind: string; key: string; label: string | null; parent: string | null; sub: string | null; status: string | null;
  impressions: number; clicks: number; cost: number; conversions: number; conv_value: number; extra: Record<string, unknown>;
}

export interface CampaignOut extends Totals {
  id: string; name: string; status: string; channel: string; bidding: string; budget: number | null;
  searchIs: number | null; lostBudget: number | null; lostRank: number | null;
  prevCost: number; prevConversions: number; prevConvValue: number;
  lastActiveDate: string;
}
export interface SegmentOut extends Totals { key: string }
export interface ItemOut extends Totals {
  key: string; label: string; parent: string; sub: string; status: string; extra: Record<string, unknown>;
}
export type Severity = "critical" | "warning" | "opportunity" | "good";
export interface Insight { severity: Severity; title: string; detail: string; action?: string }

export interface GoogleStats {
  account: { customerId: string; name: string; currency: string; lastSyncedAt: string | null; lastError: string | null; firstDataDate: string | null };
  range: { since: string; until: string; prevSince: string | null; prevUntil: string | null; days: number };
  totals: Totals;
  prev: Totals | null;
  daily: (Totals & { date: string })[];
  campaigns: CampaignOut[];
  segments: Record<string, SegmentOut[]>;
  items: Record<string, ItemOut[]>;
  insights: Insight[];
}

const pctChange = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : null);
const cpa = (t: Totals) => (t.conversions > 0 ? t.cost / t.conversions : 0);
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export async function loadGoogleStats(customerId: string, rangeIn: DateRangeInput): Promise<GoogleStats | null> {
  if (!db) throw new Error("Supabase is not configured.");
  const { data: acct } = await db.from("google_ads_accounts").select("*").eq("customer_id", customerId).maybeSingle();
  if (!acct) return null;

  const range = resolveRange(rangeIn);
  const days = daysBetween(range.since, range.until);
  const isAll = rangeIn.preset === "maximum";
  const prevUntil = iso(shift(new Date(range.since), -1));
  const prevSince = iso(shift(new Date(prevUntil), -(days - 1)));

  const lo = isAll ? range.since : prevSince;
  const [campRows, segRows, itemRows] = await Promise.all([
    fetchAll<CampDailyRow>((f, t) =>
      db!.from("google_ads_campaign_daily").select("campaign_id,date,campaign_name,status,channel_type,bidding,budget,impressions,clicks,cost,conversions,conv_value,search_is,lost_is_budget,lost_is_rank")
        .eq("customer_id", customerId).gte("date", lo).lte("date", range.until).order("date").range(f, t)
    ),
    fetchAll<SegRow>((f, t) =>
      db!.from("google_ads_segment_daily").select("date,dimension,key,impressions,clicks,cost,conversions,conv_value")
        .eq("customer_id", customerId).gte("date", range.since).lte("date", range.until).order("date").range(f, t)
    ),
    fetchAll<ItemRow>((f, t) =>
      db!.from("google_ads_items").select("kind,key,label,parent,sub,status,impressions,clicks,cost,conversions,conv_value,extra")
        .eq("customer_id", customerId).order("cost", { ascending: false }).range(f, t)
    ),
  ]);

  // ---- totals, daily, campaigns ----------------------------------------
  const totals = zero();
  const prev = zero();
  const dailyMap = new Map<string, Totals>();
  const camp = new Map<string, CampaignOut & { isW: number; isImp: number; lbW: number; lrW: number; isDays: number }>();

  for (const r of campRows) {
    const inCurrent = r.date >= range.since;
    if (inCurrent) {
      add(totals, r);
      const d = dailyMap.get(r.date) ?? zero();
      add(d, r);
      dailyMap.set(r.date, d);
    } else {
      add(prev, r);
    }
    const c = camp.get(r.campaign_id) ?? {
      id: r.campaign_id, name: r.campaign_name ?? r.campaign_id, status: r.status ?? "", channel: r.channel_type ?? "", bidding: r.bidding ?? "",
      budget: null, ...zero(), searchIs: null, lostBudget: null, lostRank: null, prevCost: 0, prevConversions: 0, prevConvValue: 0,
      lastActiveDate: "", isW: 0, isImp: 0, lbW: 0, lrW: 0, isDays: 0,
    };
    // Newest row wins for name / status / budget.
    if (!c.lastActiveDate || r.date >= c.lastActiveDate) {
      c.lastActiveDate = r.date;
      c.name = r.campaign_name ?? c.name;
      c.status = r.status ?? c.status;
      c.channel = r.channel_type ?? c.channel;
      c.bidding = r.bidding ?? c.bidding;
      c.budget = r.budget ?? c.budget;
    }
    if (inCurrent) {
      add(c, r);
      if (r.search_is != null && Number(r.impressions) > 0) {
        const w = Number(r.impressions);
        c.isImp += w;
        c.isW += Number(r.search_is) * w;
        c.lbW += Number(r.lost_is_budget ?? 0) * w;
        c.lrW += Number(r.lost_is_rank ?? 0) * w;
      }
    } else {
      c.prevCost += Number(r.cost);
      c.prevConversions += Number(r.conversions);
      c.prevConvValue += Number(r.conv_value);
    }
    camp.set(r.campaign_id, c);
  }

  const campaigns: CampaignOut[] = [...camp.values()]
    .map((c) => ({
      ...c,
      searchIs: c.isImp > 0 ? c.isW / c.isImp : null,
      lostBudget: c.isImp > 0 ? c.lbW / c.isImp : null,
      lostRank: c.isImp > 0 ? c.lrW / c.isImp : null,
    }))
    .filter((c) => c.impressions > 0 || c.cost > 0 || c.status === "ENABLED")
    .sort((a, b) => b.cost - a.cost);

  const daily = [...dailyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, t]) => ({ date, ...t }));

  // ---- segments -----------------------------------------------------------
  const segments: Record<string, SegmentOut[]> = {};
  const segAgg = new Map<string, SegmentOut>();
  for (const r of segRows) {
    const id = `${r.dimension}|${r.key}`;
    const s = segAgg.get(id) ?? { key: r.key, ...zero() };
    add(s, r);
    segAgg.set(id, s);
    segments[r.dimension] ??= [];
  }
  for (const dim of Object.keys(segments)) {
    segments[dim] = [...segAgg.entries()].filter(([id]) => id.startsWith(dim + "|")).map(([, v]) => v);
    segments[dim].sort(dim === "hour" ? (a, b) => Number(a.key) - Number(b.key) : (a, b) => b.cost - a.cost);
  }

  // ---- leaderboards -------------------------------------------------------
  const items: Record<string, ItemOut[]> = {};
  for (const r of itemRows) {
    (items[r.kind] ??= []).push({
      key: r.key, label: r.label ?? "", parent: r.parent ?? "", sub: r.sub ?? "", status: r.status ?? "", extra: r.extra ?? {},
      impressions: Number(r.impressions), clicks: Number(r.clicks), cost: Number(r.cost), conversions: Number(r.conversions), convValue: Number(r.conv_value),
    });
  }

  const currency = (acct.currency as string) || "";
  const stats: GoogleStats = {
    account: { customerId, name: acct.name ?? customerId, currency, lastSyncedAt: acct.last_synced_at, lastError: acct.last_error, firstDataDate: acct.first_data_date },
    range: { since: range.since, until: range.until, prevSince: isAll ? null : prevSince, prevUntil: isAll ? null : prevUntil, days },
    totals,
    prev: isAll ? null : prev,
    daily,
    campaigns,
    segments,
    items,
    insights: [],
  };
  stats.insights = buildInsights(stats, campRows);
  return stats;
}

// ---------------------------------------------------------------------------
// Rules an account manager applies by eye every morning, made explicit.
// ---------------------------------------------------------------------------
function buildInsights(s: GoogleStats, campRows: CampDailyRow[]): Insight[] {
  const out: Insight[] = [];
  const { totals, prev, campaigns, items, segments } = s;
  const money = (n: number) => `${s.account.currency ? s.account.currency + " " : ""}${fmt(n)}`;

  if (totals.cost === 0) {
    out.push({ severity: "warning", title: "No spend in this period", detail: "Nothing was spent in the selected dates. Check that campaigns are enabled, billing is active and budgets are set." });
    return out;
  }

  // 1. Period-over-period health
  if (prev && prev.cost > 0) {
    const costCh = pctChange(totals.cost, prev.cost);
    const convCh = pctChange(totals.conversions, prev.conversions);
    const cpaCur = cpa(totals);
    const cpaPrev = cpa(prev);
    if (costCh != null && costCh > 0.15 && (convCh ?? 0) < -0.05) {
      out.push({ severity: "critical", title: "Spend is up but conversions are down", detail: `Spend ${(costCh * 100).toFixed(0)}% higher than the previous period while conversions moved ${convCh != null ? (convCh * 100).toFixed(0) + "%" : "n/a"}.`, action: "Review search terms and the campaigns with rising CPA below; pause or cap what is not converting." });
    } else if (cpaCur > 0 && cpaPrev > 0 && cpaCur > cpaPrev * 1.25) {
      out.push({ severity: "warning", title: "Cost per conversion is rising", detail: `CPA is ${money(cpaCur)} vs ${money(cpaPrev)} in the previous period (+${(((cpaCur - cpaPrev) / cpaPrev) * 100).toFixed(0)}%).`, action: "Check which campaigns drove the increase in the Campaigns tab (sort by CPA)." });
    } else if (cpaCur > 0 && cpaPrev > 0 && cpaCur < cpaPrev * 0.85) {
      out.push({ severity: "good", title: "Cost per conversion improved", detail: `CPA fell ${(((cpaPrev - cpaCur) / cpaPrev) * 100).toFixed(0)}% to ${money(cpaCur)}.`, action: "Consider scaling budget on the campaigns behind this improvement." });
    }
    const ctrCur = totals.impressions ? totals.clicks / totals.impressions : 0;
    const ctrPrev = prev.impressions ? prev.clicks / prev.impressions : 0;
    if (ctrPrev > 0 && ctrCur < ctrPrev * 0.8) {
      out.push({ severity: "warning", title: "Click-through rate dropped", detail: `CTR ${(ctrCur * 100).toFixed(2)}% vs ${(ctrPrev * 100).toFixed(2)}% before.`, action: "Refresh ad copy or tighten keyword match types — ads may be showing on less relevant searches." });
    }
  }

  // 2. Budget-limited winners
  for (const c of campaigns.filter((c) => c.status === "ENABLED" && (c.lostBudget ?? 0) >= 0.1 && c.conversions > 0).slice(0, 3)) {
    out.push({ severity: "opportunity", title: `“${c.name}” is losing ${((c.lostBudget ?? 0) * 100).toFixed(0)}% of searches to budget`, detail: `It converts (${c.conversions.toFixed(1)} conversions at ${money(cpa(c))} each) but the daily budget${c.budget ? ` of ${money(c.budget)}` : ""} runs out before the day does.`, action: "Raise the daily budget or move budget from a weaker campaign." });
  }
  // 3. Rank-limited
  for (const c of campaigns.filter((c) => c.status === "ENABLED" && (c.lostRank ?? 0) >= 0.3 && c.cost > 0).slice(0, 2)) {
    out.push({ severity: "warning", title: `“${c.name}” loses ${((c.lostRank ?? 0) * 100).toFixed(0)}% of searches to ad rank`, detail: "Competitors' ads are outranking yours — a bid, quality score or ad relevance problem.", action: "Improve ad copy / landing page relevance, or raise target CPA / bids." });
  }
  // 4. Spending with no return
  const bigSpend = campaigns.filter((c) => c.cost >= totals.cost * 0.05 && c.conversions === 0);
  for (const c of bigSpend.slice(0, 3)) {
    out.push({ severity: "critical", title: `“${c.name}” spent ${money(c.cost)} with no conversions`, detail: `${((c.cost / totals.cost) * 100).toFixed(0)}% of the period's spend produced nothing measurable.`, action: "Verify conversion tracking on this campaign, then pause or restructure it." });
  }
  // 5. Wasted search terms
  const terms = items.search_term ?? [];
  const waste = terms.filter((t) => t.conversions === 0 && t.clicks >= 8).sort((a, b) => b.cost - a.cost);
  if (waste.length > 0) {
    const total = waste.reduce((a, t) => a + t.cost, 0);
    out.push({ severity: "warning", title: `${waste.length} search terms cost ${money(total)} (30d) with zero conversions`, detail: `Biggest: ${waste.slice(0, 3).map((t) => `“${t.label}”`).join(", ")}.`, action: "Open the Search terms tab and add irrelevant ones as negative keywords." });
  }
  // 6. Low quality score with spend
  const lowQs = (items.keyword ?? []).filter((k) => (k.extra.qualityScore as number | null) != null && (k.extra.qualityScore as number) <= 4 && k.cost > 0);
  if (lowQs.length > 0) {
    out.push({ severity: "warning", title: `${lowQs.length} keywords have a Quality Score of 4 or lower`, detail: `They cost ${money(lowQs.reduce((a, k) => a + k.cost, 0))} in the last 30 days — low Quality Score raises your cost per click.`, action: "Tighten their ad groups, match the ad copy to the keyword and check landing-page relevance." });
  }
  // 7. Ads with policy trouble / weak strength
  const ads = items.ad ?? [];
  const disapproved = ads.filter((a) => ["DISAPPROVED", "AREA_OF_INTEREST_ONLY"].includes(String(a.extra.approval)));
  if (disapproved.length > 0) {
    out.push({ severity: "critical", title: `${disapproved.length} ad${disapproved.length > 1 ? "s are" : " is"} disapproved or restricted`, detail: disapproved.slice(0, 2).map((a) => `“${a.label}”`).join(", "), action: "Open the ad in Google Ads, read the policy reason and resubmit." });
  }
  const poor = ads.filter((a) => a.extra.strength === "POOR" && a.cost > 0);
  if (poor.length > 0) {
    out.push({ severity: "opportunity", title: `${poor.length} responsive search ads have “Poor” ad strength`, detail: "Add more unique headlines and descriptions so Google can test combinations.", action: "Aim for 12+ distinct headlines and 3+ descriptions per ad." });
  }
  // 8. Underspending campaigns (last 7 days vs budget)
  const cutoff = iso(shift(new Date(s.range.until), -6));
  const recent = new Map<string, { cost: number; days: Set<string>; budget: number | null; name: string; status: string }>();
  for (const r of campRows.filter((r) => r.date >= cutoff && r.date <= s.range.until)) {
    const c = recent.get(r.campaign_id) ?? { cost: 0, days: new Set<string>(), budget: null, name: r.campaign_name ?? r.campaign_id, status: r.status ?? "" };
    c.cost += Number(r.cost);
    c.days.add(r.date);
    c.budget = r.budget ?? c.budget;
    c.status = r.status ?? c.status;
    recent.set(r.campaign_id, c);
  }
  for (const c of [...recent.values()].filter((c) => c.status === "ENABLED" && c.budget && c.budget > 0 && c.days.size >= 5 && c.cost / c.days.size < c.budget * 0.4).slice(0, 2)) {
    out.push({ severity: "opportunity", title: `“${c.name}” is using only ${(((c.cost / c.days.size) / (c.budget as number)) * 100).toFixed(0)}% of its budget`, detail: `Averaging ${money(c.cost / c.days.size)}/day against a ${money(c.budget as number)} budget — it can't find enough eligible traffic.`, action: "Broaden keywords/audiences, raise bids, or reallocate the unused budget." });
  }
  // 9. Device efficiency gap
  const dev = (segments.device ?? []).filter((d) => d.cost >= totals.cost * 0.1);
  if (dev.length >= 2) {
    const withCpa = dev.filter((d) => d.conversions > 0).map((d) => ({ d, cpa: cpa(d) }));
    if (withCpa.length >= 2) {
      const best = withCpa.reduce((a, b) => (a.cpa <= b.cpa ? a : b));
      const worst = withCpa.reduce((a, b) => (a.cpa >= b.cpa ? a : b));
      if (worst.cpa > best.cpa * 1.5) {
        out.push({ severity: "opportunity", title: `${worst.d.key.toLowerCase()} converts ${(worst.cpa / best.cpa).toFixed(1)}× more expensively than ${best.d.key.toLowerCase()}`, detail: `CPA ${money(worst.cpa)} vs ${money(best.cpa)}.`, action: `Lower the bid adjustment on ${worst.d.key.toLowerCase()} or raise it on ${best.d.key.toLowerCase()}.` });
      }
    }
  }

  if (out.length === 0) out.push({ severity: "good", title: "No issues detected", detail: "Spend, conversions and delivery all look healthy for this period." });
  const order: Record<Severity, number> = { critical: 0, warning: 1, opportunity: 2, good: 3 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ---------------------------------------------------------------------------
// Slim per-day series across a set of accounts, for the Overview page.
// ---------------------------------------------------------------------------
export async function loadGoogleOverview(customerIds: string[], rangeIn: DateRangeInput) {
  if (!db || customerIds.length === 0) return null;
  const { since, until } = resolveRange(rangeIn);
  const rows = await fetchAll<CampDailyRow & { customer_id: string }>((f, t) =>
    db!.from("google_ads_campaign_daily").select("customer_id,campaign_id,date,campaign_name,impressions,clicks,cost,conversions,conv_value")
      .in("customer_id", customerIds).gte("date", since).lte("date", until).order("date").range(f, t)
  );
  if (rows.length === 0) return null;
  return rows;
}

// ---------------------------------------------------------------------------
// Overview integration: Google Ads as a PlatformDataset, same shape as Meta.
// ---------------------------------------------------------------------------
export async function resolveGoogleCustomers(clientName?: string): Promise<string[]> {
  if (!db) return [];
  let q = db.from("clients").select("google_ads_account_id").not("google_ads_account_id", "is", null);
  if (clientName) q = q.eq("name", clientName);
  const { data } = await q;
  return [...new Set((data ?? []).map((c) => (c.google_ads_account_id as string).replace(/[^0-9]/g, "")).filter(Boolean))];
}

export async function fetchGoogleAdsData(customerIds: string[], range: DateRangeInput): Promise<PlatformDataset | null> {
  const rows = await loadGoogleOverview(customerIds, range);
  if (!rows) return null;

  const t = zero();
  const byDay = new Map<string, Totals>();
  const byCamp = new Map<string, { name: string; t: Totals }>();
  for (const r of rows) {
    add(t, r);
    const d = byDay.get(r.date) ?? zero();
    add(d, r);
    byDay.set(r.date, d);
    const key = `${r.customer_id}~${r.campaign_id}`;
    const c = byCamp.get(key) ?? { name: r.campaign_name ?? r.campaign_id, t: zero() };
    add(c.t, r);
    byCamp.set(key, c);
  }

  return {
    platform: "google",
    kpis: {
      totalSpend: t.cost,
      impressions: t.impressions,
      clicks: t.clicks,
      conversions: t.conversions,
      leads: t.conversions,
      costPerLead: t.conversions > 0 ? t.cost / t.conversions : 0,
      revenue: t.convValue,
      roas: t.cost > 0 ? t.convValue / t.cost : 0,
      ctr: t.impressions > 0 ? t.clicks / t.impressions : 0,
      cpc: t.clicks > 0 ? t.cost / t.clicks : 0,
    },
    timeseries: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, spend: d.cost, revenue: d.convValue, leads: d.conversions })),
    campaigns: [...byCamp.entries()].map(([id, c]) => ({
      id, name: c.name, platform: "google" as const, spend: c.t.cost, revenue: c.t.convValue,
      roas: c.t.cost > 0 ? c.t.convValue / c.t.cost : 0, conversions: c.t.conversions,
    })),
  };
}
