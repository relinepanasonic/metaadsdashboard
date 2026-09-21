"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Coins,
  Eye,
  Gauge,
  Lightbulb,
  MousePointerClick,
  Percent,
  Plug,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import KpiCard from "@/components/KpiCard";
import Panel from "@/components/Panel";
import CustomSelect from "@/components/CustomSelect";
import DateRangePicker, { type DateRangeValue } from "@/components/DateRangePicker";
import GoogleAdsSetup from "./GoogleAdsSetup";
import { formatNumber } from "@/lib/format";
import type { CampaignOut, GoogleStats, Insight, ItemOut, Severity, Totals } from "@/lib/services/googleAdsStats";
import {
  ColumnChart, DataTable, QsBadge, ShareBars, StatusBadge, TrendChart, convRate, cpa, cpc, ctr, dec, label, makeMoney, pct, roas,
  type Col,
} from "./parts";

type TabId = "overview" | "campaigns" | "adgroups" | "keywords" | "terms" | "audience" | "insights" | "connection";

export interface AccountsResponse {
  configured: boolean;
  oauthConfigured: boolean;
  accounts: { customer_id: string; name: string | null; currency: string | null; last_synced_at: string | null; last_error: string | null; brand: string | null }[];
  unsyncedBrands: { brand: string; customerId: string }[];
  live?: { customerId: string; name: string; currency: string; isManager: boolean; brand: string | null }[];
  liveError?: string;
}

const SEV: Record<Severity, { icon: typeof AlertOctagon; color: string; bg: string; name: string }> = {
  critical: { icon: AlertOctagon, color: "#fb7185", bg: "rgba(251,113,133,0.08)", name: "Critical" },
  warning: { icon: AlertTriangle, color: "#fbbf24", bg: "rgba(251,191,36,0.08)", name: "Warning" },
  opportunity: { icon: Lightbulb, color: "#22d3ee", bg: "rgba(34,211,238,0.08)", name: "Opportunity" },
  good: { icon: CheckCircle2, color: "#34d399", bg: "rgba(52,211,153,0.08)", name: "Good" },
};

function change(cur: number, prev: number | undefined, lowerIsBetter = false): { delta: string; positive: boolean } | undefined {
  if (prev == null || prev <= 0 || cur <= 0) return undefined;
  const c = (cur - prev) / prev;
  return { delta: `${Math.abs(c * 100).toFixed(1)}%`, positive: lowerIsBetter ? c <= 0 : c >= 0 };
}

const inputCls =
  "rounded-lg border border-white/[0.12] bg-[#0b0e14] py-2 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none";

export default function GoogleAdsDashboard({ isClient, canConnect }: { isClient: boolean; canConnect: boolean }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [range, setRange] = useState<DateRangeValue>({ preset: "last_30d" });
  const [customerId, setCustomerId] = useState("");
  const [stats, setStats] = useState<GoogleStats | null>(null);
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<AccountsResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const loadAccounts = useCallback(async (live = false) => {
    if (isClient) return null;
    const j = (await fetch(`/api/google-ads/accounts${live ? "?live=1" : ""}`, { cache: "no-store" }).then((r) => r.json())) as AccountsResponse & { ok: boolean };
    if (j.ok) setAccounts(j);
    return j.ok ? j : null;
  }, [isClient]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams();
      if (customerId) p.set("customerId", customerId);
      if (range.since && range.until) {
        p.set("since", range.since);
        p.set("until", range.until);
      } else p.set("date_preset", range.preset || "last_30d");
      const j = await fetch(`/api/google-ads/stats?${p}`, { cache: "no-store" }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || "Failed to load");
      setStats(j.stats);
      setReason(j.reason ?? "");
      if (j.stats && !customerId) setCustomerId(j.stats.account.customerId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [customerId, range]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadStats(); }, [loadStats]);

  async function syncNow() {
    if (!customerId) return;
    setSyncing(true);
    setSyncMsg("");
    try {
      const j = await fetch("/api/google-ads/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, days: 30 }) }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error);
      const r = j.results?.[0];
      setSyncMsg(r ? `Synced ${r.campaignDays} campaign-days${r.errors?.length ? ` (${r.errors.length} sections skipped)` : ""}.` : "Synced.");
      await Promise.all([loadStats(), loadAccounts()]);
    } catch (e) {
      setSyncMsg((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const money = useMemo(() => makeMoney(stats?.account.currency ?? "IDR"), [stats?.account.currency]);

  // ------------------------------------------------------------ empty states
  if (loading && !stats && !error) return <div className="glass-panel p-8 text-center text-xs text-slate-500">Loading Google Ads…</div>;

  if (!stats) {
    if (isClient) {
      return (
        <div className="glass-panel p-8 text-center">
          <Plug size={28} className="mx-auto mb-3 text-slate-600" />
          <div className="text-sm font-semibold text-slate-300">{error ? "Couldn’t load Google Ads" : "No Google Ads data yet"}</div>
          <div className="mt-1 text-xs text-slate-500">
            {error || (reason === "no-account" ? "No Google Ads account is linked to your brand yet. Your account manager can set it up." : "Your Google Ads data is being prepared — check back after the next daily update.")}
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        {error && <div className="glass-panel p-3 text-xs text-rose-300">{error}</div>}
        <GoogleAdsSetup canConnect={canConnect} accounts={accounts} reload={loadAccounts} onSynced={loadStats} />
      </div>
    );
  }

  const cmpLabel = `vs previous ${stats.range.days}d`;
  const critical = stats.insights.filter((i) => i.severity === "critical" || i.severity === "warning").length;

  const tabs: { id: TabId; name: string; badge?: number }[] = [
    { id: "overview", name: "Overview" },
    { id: "campaigns", name: "Campaigns" },
    { id: "adgroups", name: "Ad groups & Ads" },
    { id: "keywords", name: "Keywords" },
    { id: "terms", name: "Search terms" },
    { id: "audience", name: "Audience & Time" },
    { id: "insights", name: "Insights", badge: critical },
    ...(isClient ? [] : [{ id: "connection" as TabId, name: "Connection" }]),
  ];

  const staleHours = stats.account.lastSyncedAt ? (Date.now() - Date.parse(stats.account.lastSyncedAt)) / 3_600_000 : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="glass-panel flex flex-wrap items-center gap-3 p-3">
        {!isClient && accounts && accounts.accounts.length > 1 && (
          <CustomSelect
            className="min-w-[200px]"
            value={customerId}
            onChange={(v) => setCustomerId(v)}
            options={accounts.accounts.map((a) => ({ value: a.customer_id, label: `${a.brand ? a.brand + " · " : ""}${a.name ?? a.customer_id}` }))}
          />
        )}
        {(isClient || (accounts?.accounts.length ?? 0) <= 1) && (
          <div className="text-xs">
            <span className="font-semibold text-slate-100">{stats.account.name}</span>
            <span className="ml-2 text-slate-500">{stats.account.customerId.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")} · {stats.account.currency}</span>
          </div>
        )}
        <DateRangePicker value={range} onChange={setRange} />
        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          {syncMsg && <span className="text-slate-400">{syncMsg}</span>}
          {stats.account.lastSyncedAt && (
            <span className={staleHours != null && staleHours > 36 ? "text-amber-400" : ""}>
              Updated {new Date(stats.account.lastSyncedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {!isClient && (
            <button onClick={syncNow} disabled={syncing} className="glass-panel glass-panel-hover flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-200 disabled:opacity-50">
              <RefreshCw size={13} className={syncing ? "animate-spin text-cyan-400" : "text-cyan-400"} />
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          )}
        </div>
      </div>

      {stats.account.lastError && !isClient && (
        <div className="glass-panel p-3 text-xs text-amber-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
          Last sync reported: {stats.account.lastError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.06] bg-[#0b0e14]/60 p-1.5">
        {tabs.map((x) => {
          const active = tab === x.id;
          return (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${active ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}
              style={active ? { boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" } : undefined}
            >
              {x.name}
              {x.badge ? <span className="rounded-full bg-rose-500/20 px-1.5 text-[10px] font-bold text-rose-300">{x.badge}</span> : null}
            </button>
          );
        })}
      </div>

      {loading && <div className="text-center text-[11px] text-slate-500">Refreshing…</div>}

      {tab === "overview" && <Overview stats={stats} money={money} cmpLabel={cmpLabel} onOpenInsights={() => setTab("insights")} />}
      {tab === "campaigns" && <CampaignsTab campaigns={stats.campaigns} money={money} />}
      {tab === "adgroups" && <AdGroupsTab items={stats.items} money={money} />}
      {tab === "keywords" && <KeywordsTab items={stats.items.keyword ?? []} money={money} />}
      {tab === "terms" && <TermsTab items={stats.items.search_term ?? []} money={money} />}
      {tab === "audience" && <AudienceTab stats={stats} money={money} />}
      {tab === "insights" && <InsightsTab insights={stats.insights} />}
      {tab === "connection" && !isClient && <GoogleAdsSetup canConnect={canConnect} accounts={accounts} reload={loadAccounts} onSynced={loadStats} />}

    </div>
  );
}

// ================================================================ OVERVIEW ==

function Overview({ stats, money, cmpLabel, onOpenInsights }: { stats: GoogleStats; money: (n: number, c?: boolean) => string; cmpLabel: string; onOpenInsights: () => void }) {
  const t = stats.totals;
  const p = stats.prev;
  const d = (cur: number, prev: number | undefined, lower = false) => change(cur, prev, lower);
  const card = (labelText: string, value: string, icon: typeof Wallet, accent: "cyan" | "blue" | "magenta" | "violet", ch?: { delta: string; positive: boolean }) => (
    <KpiCard label={labelText} value={value} icon={icon} accent={accent} delta={ch?.delta} deltaPositive={ch?.positive} deltaLabel={cmpLabel} />
  );

  const channelMix = useMemo(() => {
    const m = new Map<string, Totals & { key: string }>();
    for (const c of stats.campaigns) {
      const cur = m.get(c.channel) ?? { key: c.channel || "UNKNOWN", impressions: 0, clicks: 0, cost: 0, conversions: 0, convValue: 0 };
      cur.impressions += c.impressions; cur.clicks += c.clicks; cur.cost += c.cost; cur.conversions += c.conversions; cur.convValue += c.convValue;
      m.set(c.channel, cur);
    }
    return [...m.values()].sort((a, b) => b.cost - a.cost);
  }, [stats.campaigns]);

  const top = stats.insights.filter((i) => i.severity !== "good").slice(0, 3);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {card("Spend", money(t.cost), Wallet, "blue", d(t.cost, p?.cost, true))}
        {card("Conversions", dec(t.conversions, 1), Target, "cyan", d(t.conversions, p?.conversions))}
        {card("Cost / conversion", t.conversions > 0 ? money(cpa(t)) : "—", Coins, "violet", d(cpa(t), p ? cpa(p) : undefined, true))}
        {card("ROAS", t.cost > 0 && t.convValue > 0 ? `${dec(roas(t), 2)}×` : "—", TrendingUp, "magenta", d(roas(t), p ? roas(p) : undefined))}
        {card("Clicks", formatNumber(t.clicks), MousePointerClick, "cyan", d(t.clicks, p?.clicks))}
        {card("Impressions", formatNumber(t.impressions), Eye, "blue", d(t.impressions, p?.impressions))}
        {card("CTR", pct(ctr(t), 2), Percent, "violet", d(ctr(t), p ? ctr(p) : undefined))}
        {card("Avg. CPC", t.clicks > 0 ? money(cpc(t), false) : "—", Gauge, "magenta", d(cpc(t), p ? cpc(p) : undefined, true))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Spend & conversions"
          subtitle={`${stats.range.since} → ${stats.range.until}`}
          className="lg:col-span-2"
          bodyClassName="h-[300px]"
          right={<div className="text-right"><div className="neon-text-cyan text-lg font-black">{money(t.cost)}</div><div className="text-[10px] text-slate-500">total spend</div></div>}
        >
          {stats.daily.length > 0 ? <TrendChart data={stats.daily} money={money} /> : <div className="grid h-full place-items-center text-xs text-slate-500">No data in this range.</div>}
        </Panel>

        <Panel title="Spend by campaign type" subtitle="Where the budget goes" bodyClassName="max-h-[300px] overflow-y-auto pr-1">
          <ShareBars rows={channelMix} money={money} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Top campaigns" subtitle="By spend" className="lg:col-span-2" bodyClassName="">
          <DataTable
            rows={stats.campaigns.slice(0, 8)}
            defaultSort="cost"
            rowKey={(c) => c.id}
            minWidth={560}
            pageSize={8}
            cols={[
              { key: "name", label: "Campaign", render: (c) => <span className="font-medium text-slate-100">{c.name}</span> },
              { key: "cost", label: "Spend", align: "right", sort: (c) => c.cost, render: (c) => money(c.cost) },
              { key: "conv", label: "Conv.", align: "right", sort: (c) => c.conversions, render: (c) => dec(c.conversions, 1) },
              { key: "cpa", label: "CPA", align: "right", sort: (c) => cpa(c), render: (c) => (c.conversions > 0 ? money(cpa(c)) : "—") },
              { key: "roas", label: "ROAS", align: "right", sort: (c) => roas(c), render: (c) => (c.convValue > 0 ? `${dec(roas(c), 2)}×` : "—") },
            ]}
          />
        </Panel>

        <Panel
          title="Needs attention"
          subtitle="Highest-impact findings"
          right={<button onClick={onOpenInsights} className="text-[11px] font-semibold text-cyan-300 hover:underline">All insights →</button>}
        >
          {top.length === 0 ? (
            <div className="flex items-center gap-2 py-6 text-xs text-emerald-300"><CheckCircle2 size={16} /> Nothing urgent — account looks healthy.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {top.map((i, idx) => <InsightCard key={idx} insight={i} compact />)}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

// ================================================================ CAMPAIGNS ==

// Standard performance columns shared by every table below.
function perfCols<T extends Totals>(money: (n: number, c?: boolean) => string): Col<T>[] {
  return [
    { key: "cost", label: "Spend", align: "right", sort: (r) => r.cost, render: (r) => money(r.cost) },
    { key: "impr", label: "Impr.", align: "right", sort: (r) => r.impressions, render: (r) => formatNumber(r.impressions) },
    { key: "clicks", label: "Clicks", align: "right", sort: (r) => r.clicks, render: (r) => formatNumber(r.clicks) },
    { key: "ctr", label: "CTR", align: "right", sort: (r) => ctr(r), render: (r) => pct(ctr(r), 2) },
    { key: "cpc", label: "CPC", align: "right", sort: (r) => cpc(r), render: (r) => (r.clicks > 0 ? money(cpc(r), false) : "—") },
    { key: "conv", label: "Conv.", align: "right", sort: (r) => r.conversions, render: (r) => dec(r.conversions, 1) },
    { key: "cvr", label: "Conv. rate", align: "right", sort: (r) => convRate(r), render: (r) => pct(convRate(r), 2) },
    { key: "cpa", label: "CPA", align: "right", sort: (r) => (r.conversions > 0 ? cpa(r) : Infinity), render: (r) => (r.conversions > 0 ? money(cpa(r)) : "—") },
    { key: "roas", label: "ROAS", align: "right", sort: (r) => roas(r), render: (r) => (r.convValue > 0 ? `${dec(roas(r), 2)}×` : "—") },
  ];
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-[200px]">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} w-full`} />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${active ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:bg-white/[0.04]"}`}
      style={active ? { boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" } : undefined}
    >
      {children}
    </button>
  );
}

function CampaignsTab({ campaigns, money }: { campaigns: CampaignOut[]; money: (n: number, c?: boolean) => string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "ENABLED" | "PAUSED">("all");
  const rows = campaigns.filter((c) => (status === "all" || c.status === status) && c.name.toLowerCase().includes(q.toLowerCase()));

  const cols: Col<CampaignOut>[] = [
    { key: "name", label: "Campaign", sort: (c) => c.name.toLowerCase(), render: (c) => <span className="font-medium text-slate-100">{c.name}</span> },
    { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
    { key: "type", label: "Type", render: (c) => <span className="text-slate-400">{label(c.channel)}</span> },
    { key: "budget", label: "Budget/day", align: "right", sort: (c) => c.budget ?? 0, render: (c) => (c.budget ? money(c.budget) : "—") },
    ...perfCols<CampaignOut>(money),
    { key: "is", label: "Search IS", align: "right", sort: (c) => c.searchIs ?? -1, render: (c) => (c.searchIs != null ? pct(c.searchIs, 0) : "—") },
    {
      key: "lost", label: "Lost IS (budget / rank)", align: "right", sort: (c) => (c.lostBudget ?? 0) + (c.lostRank ?? 0),
      render: (c) => (c.lostBudget != null ? <span><span className={c.lostBudget >= 0.1 ? "text-amber-300" : ""}>{pct(c.lostBudget, 0)}</span> / <span className={(c.lostRank ?? 0) >= 0.3 ? "text-amber-300" : ""}>{pct(c.lostRank ?? 0, 0)}</span></span> : "—"),
    },
    {
      key: "trend", label: "Spend vs prev.", align: "right", sort: (c) => (c.prevCost > 0 ? (c.cost - c.prevCost) / c.prevCost : 0),
      render: (c) => {
        if (c.prevCost <= 0) return <span className="text-slate-600">—</span>;
        const ch = (c.cost - c.prevCost) / c.prevCost;
        return <span className={ch > 0.25 ? "text-amber-300" : ch < -0.25 ? "text-cyan-300" : "text-slate-400"}>{ch >= 0 ? "+" : ""}{(ch * 100).toFixed(0)}%</span>;
      },
    },
  ];

  return (
    <Panel
      title="Campaigns"
      subtitle={`${rows.length} of ${campaigns.length} · click a column to sort`}
      right={
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={status === "all"} onClick={() => setStatus("all")}>All</Chip>
          <Chip active={status === "ENABLED"} onClick={() => setStatus("ENABLED")}>Active</Chip>
          <Chip active={status === "PAUSED"} onClick={() => setStatus("PAUSED")}>Paused</Chip>
          <SearchBox value={q} onChange={setQ} placeholder="Filter campaigns…" />
        </div>
      }
    >
      <DataTable rows={rows} cols={cols} defaultSort="cost" rowKey={(c) => c.id} minWidth={1500} empty="No campaigns match." />
    </Panel>
  );
}

// ============================================================ AD GROUPS & ADS ==

const SNAPSHOT_NOTE = "Rolling last 30 days — refreshed with each sync, independent of the date picker.";

function AdGroupsTab({ items, money }: { items: Record<string, ItemOut[]>; money: (n: number, c?: boolean) => string }) {
  const groups = items.ad_group ?? [];
  const ads = items.ad ?? [];
  return (
    <>
      <Panel title="Ad groups" subtitle={SNAPSHOT_NOTE}>
        <DataTable
          rows={groups}
          defaultSort="cost"
          rowKey={(r) => r.key}
          minWidth={1000}
          empty="No ad group data yet — run a sync."
          cols={[
            { key: "name", label: "Ad group", sort: (r) => r.label.toLowerCase(), render: (r) => <span className="font-medium text-slate-100">{r.label}</span> },
            { key: "camp", label: "Campaign", render: (r) => <span className="text-slate-400">{r.parent}</span> },
            { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
            ...perfCols<ItemOut>(money),
          ]}
        />
      </Panel>
      <Panel title="Ads" subtitle={`${SNAPSHOT_NOTE} Shows approval status and ad strength.`}>
        <DataTable
          rows={ads}
          defaultSort="cost"
          rowKey={(r) => r.key}
          minWidth={1100}
          pageSize={15}
          empty="No ad data yet — Performance Max and Shopping campaigns don't expose individual ads."
          cols={[
            {
              key: "ad", label: "Ad", sort: (r) => r.label.toLowerCase(),
              render: (r) => (
                <div className="max-w-[320px]">
                  <div className="truncate font-medium text-slate-100" title={r.label}>{r.label}</div>
                  <div className="truncate text-[10px] text-slate-500">{r.parent} · {r.sub}</div>
                </div>
              ),
            },
            {
              key: "approval", label: "Approval",
              render: (r) => {
                const a = String(r.extra.approval ?? "");
                const bad = a === "DISAPPROVED" || a === "AREA_OF_INTEREST_ONLY";
                return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${bad ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>{label(a) || "—"}</span>;
              },
            },
            {
              key: "strength", label: "Strength",
              render: (r) => {
                const s = String(r.extra.strength ?? "");
                const cls = s === "EXCELLENT" || s === "GOOD" ? "text-emerald-300" : s === "POOR" ? "text-rose-300" : "text-slate-400";
                return <span className={cls}>{s && s !== "UNSPECIFIED" && s !== "UNKNOWN" ? label(s) : "—"}</span>;
              },
            },
            ...perfCols<ItemOut>(money),
          ]}
        />
      </Panel>
    </>
  );
}

// ================================================================= KEYWORDS ==

function KeywordsTab({ items, money }: { items: ItemOut[]; money: (n: number, c?: boolean) => string }) {
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "lowqs" | "noconv">("all");
  const rows = items.filter((k) => {
    if (q && !k.label.toLowerCase().includes(q.toLowerCase())) return false;
    if (only === "lowqs") return (k.extra.qualityScore as number | null) != null && (k.extra.qualityScore as number) <= 4;
    if (only === "noconv") return k.conversions === 0 && k.cost > 0;
    return true;
  });
  return (
    <Panel
      title="Keywords"
      subtitle={`${rows.length} of ${items.length} · ${SNAPSHOT_NOTE}`}
      right={
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={only === "all"} onClick={() => setOnly("all")}>All</Chip>
          <Chip active={only === "lowqs"} onClick={() => setOnly("lowqs")}>Low Quality Score</Chip>
          <Chip active={only === "noconv"} onClick={() => setOnly("noconv")}>Spend, no conversions</Chip>
          <SearchBox value={q} onChange={setQ} placeholder="Filter keywords…" />
        </div>
      }
    >
      <DataTable
        rows={rows}
        defaultSort="cost"
        rowKey={(r) => r.key}
        minWidth={1200}
        empty="No keywords match — Search campaigns only, and a sync must have run."
        cols={[
          {
            key: "kw", label: "Keyword", sort: (r) => r.label.toLowerCase(),
            render: (r) => (
              <div>
                <div className="font-medium text-slate-100">{r.label}</div>
                <div className="text-[10px] text-slate-500">{r.parent} · {r.sub}</div>
              </div>
            ),
          },
          { key: "match", label: "Match", sort: (r) => String(r.extra.matchType ?? ""), render: (r) => <span className="text-slate-400">{label(String(r.extra.matchType ?? ""))}</span> },
          { key: "qs", label: "Quality", align: "right", sort: (r) => (r.extra.qualityScore as number | null) ?? -1, render: (r) => <QsBadge score={(r.extra.qualityScore as number | null) ?? null} /> },
          ...perfCols<ItemOut>(money),
        ]}
      />
    </Panel>
  );
}

// ============================================================ SEARCH TERMS ==

function TermsTab({ items, money }: { items: ItemOut[]; money: (n: number, c?: boolean) => string }) {
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "waste" | "winners">("all");
  const wasted = items.filter((t) => t.conversions === 0 && t.clicks >= 8);
  const wastedCost = wasted.reduce((a, t) => a + t.cost, 0);
  const rows = items.filter((t) => {
    if (q && !t.label.toLowerCase().includes(q.toLowerCase())) return false;
    if (only === "waste") return t.conversions === 0 && t.clicks >= 8;
    if (only === "winners") return t.conversions > 0;
    return true;
  });
  return (
    <>
      {wasted.length > 0 && (
        <div className="glass-panel flex flex-wrap items-center gap-3 p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
          <AlertTriangle size={18} className="text-amber-400" />
          <div className="text-xs text-slate-300">
            <b className="text-amber-300">{wasted.length} search terms</b> drew 8+ clicks with zero conversions — <b>{money(wastedCost)}</b> in the last 30 days. Add the irrelevant ones as negative keywords in Google Ads.
          </div>
          <button onClick={() => setOnly("waste")} className="ml-auto rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25">Show them</button>
        </div>
      )}
      <Panel
        title="Search terms"
        subtitle={`${rows.length} of ${items.length} · what people actually typed · ${SNAPSHOT_NOTE}`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={only === "all"} onClick={() => setOnly("all")}>All</Chip>
            <Chip active={only === "winners"} onClick={() => setOnly("winners")}>Converting</Chip>
            <Chip active={only === "waste"} onClick={() => setOnly("waste")}>Wasted</Chip>
            <SearchBox value={q} onChange={setQ} placeholder="Filter terms…" />
          </div>
        }
      >
        <DataTable
          rows={rows}
          defaultSort="cost"
          rowKey={(r) => r.key}
          minWidth={1100}
          empty="No search terms yet — Search campaigns only, and a sync must have run."
          cols={[
            {
              key: "term", label: "Search term", sort: (r) => r.label.toLowerCase(),
              render: (r) => (
                <div>
                  <div className="font-medium text-slate-100">{r.label}</div>
                  <div className="text-[10px] text-slate-500">{r.parent} · {r.sub}</div>
                </div>
              ),
            },
            { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
            ...perfCols<ItemOut>(money),
          ]}
        />
      </Panel>
    </>
  );
}

// ========================================================== AUDIENCE & TIME ==

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AudienceTab({ stats, money }: { stats: GoogleStats; money: (n: number, c?: boolean) => string }) {
  const hours = useMemo(() => {
    const byHour = new Map((stats.segments.hour ?? []).map((s) => [Number(s.key), s]));
    return Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, "0"), cost: byHour.get(h)?.cost ?? 0, conversions: byHour.get(h)?.conversions ?? 0 }));
  }, [stats.segments.hour]);

  const weekdays = useMemo(() => {
    const acc = DOW.map((label) => ({ label, cost: 0, conversions: 0 }));
    for (const d of stats.daily) {
      const i = new Date(d.date + "T00:00:00Z").getUTCDay();
      acc[i].cost += d.cost;
      acc[i].conversions += d.conversions;
    }
    return [...acc.slice(1), acc[0]]; // Monday first
  }, [stats.daily]);

  const seg = (k: string) => stats.segments[k] ?? [];
  const bestHour = [...hours].filter((h) => h.conversions > 0).sort((a, b) => a.cost / a.conversions - b.cost / b.conversions)[0];

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="By hour of day" subtitle={bestHour ? `Cheapest conversions around ${bestHour.label}:00` : "Spend and conversions by hour"} bodyClassName="h-[280px]">
          <ColumnChart data={hours} money={money} />
        </Panel>
        <Panel title="By day of week" subtitle="Spend and conversions" bodyClassName="h-[280px]">
          <ColumnChart data={weekdays} money={money} />
        </Panel>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Devices" subtitle="Where people click"><ShareBars rows={seg("device")} money={money} /></Panel>
        <Panel title="Networks" subtitle="Search, partners, display, YouTube"><ShareBars rows={seg("network")} money={money} /></Panel>
        <Panel title="Age" subtitle="Only where age targeting reports"><ShareBars rows={seg("age")} money={money} /></Panel>
        <Panel title="Gender" subtitle="Only where gender targeting reports"><ShareBars rows={seg("gender")} money={money} /></Panel>
      </div>
    </>
  );
}

// ================================================================= INSIGHTS ==

function InsightCard({ insight, compact = false }: { insight: Insight; compact?: boolean }) {
  const s = SEV[insight.severity];
  const Icon = s.icon;
  return (
    <div className="rounded-xl p-3.5" style={{ background: s.bg, boxShadow: `inset 0 0 0 1px ${s.color}33` }}>
      <div className="flex items-start gap-2.5">
        <Icon size={16} className="mt-0.5 shrink-0" style={{ color: s.color }} />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-100">{insight.title}</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{insight.detail}</div>
          {insight.action && !compact && <div className="mt-1.5 text-[11px] font-medium" style={{ color: s.color }}>→ {insight.action}</div>}
        </div>
      </div>
    </div>
  );
}

function InsightsTab({ insights }: { insights: Insight[] }) {
  return (
    <Panel title="Insights" subtitle="Rules a senior account manager checks every morning, applied to this period">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {insights.map((i, idx) => <InsightCard key={idx} insight={i} />)}
      </div>
    </Panel>
  );
}
