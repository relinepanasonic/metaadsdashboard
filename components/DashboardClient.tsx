"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  MessageCircle,
  Target,
  Percent,
  RefreshCw,
  Activity,
  Layers,
  Building2,
  Wallet2,
  UserRound,
} from "lucide-react";
import type { UnifiedDashboardData, MetaAccount } from "@/lib/services/types";
import { formatIDR, formatNumber, formatPct } from "@/lib/format";
import KpiCard from "./KpiCard";
import Panel from "./Panel";
import SpendRevenueChart from "./SpendRevenueChart";
import SourcesDonut from "./SourcesDonut";
import TopCampaignsBar from "./TopCampaignsBar";
import ApiStatusFlow from "./ApiStatusFlow";
import CustomSelect from "./CustomSelect";
import DateRangePicker, { type DateRangeValue } from "./DateRangePicker";

const ALL = "__all__";
const ALL_ACCOUNTS = "__all_accounts__";

export default function DashboardClient() {
  const [data, setData] = useState<UnifiedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [platform, setPlatform] = useState<"both" | "meta" | "google">("both");
  const [business, setBusiness] = useState<string>(ALL);
  const [account, setAccount] = useState<string>(ALL_ACCOUNTS);
  const [client, setClient] = useState<string>(ALL);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ preset: "last_30d" });

  // Load filter option sources once.
  useEffect(() => {
    fetch("/api/meta/accounts", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setAccounts(j.accounts as MetaAccount[]))
      .catch(() => {});
    fetch("/api/clients", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setClients(j.clients as string[]))
      .catch(() => {});
  }, []);

  const businesses = useMemo(() => {
    const set = new Set(accounts.map((a) => a.business || "Other"));
    return Array.from(set);
  }, [accounts]);

  const visibleAccounts = useMemo(
    () => (business === ALL ? accounts : accounts.filter((a) => (a.business || "Other") === business)),
    [accounts, business]
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("platform", platform);
      if (account !== ALL_ACCOUNTS) params.set("accounts", account);
      if (client !== ALL) params.set("client", client);
      if (dateRange.since && dateRange.until) {
        params.set("since", dateRange.since);
        params.set("until", dateRange.until);
      } else {
        params.set("date_preset", dateRange.preset || "last_30d");
      }

      const res = await fetch(`/api/dashboard?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to load");
      setData(json.data as UnifiedDashboardData);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, account, client, dateRange]);

  return (
    <div className="relative z-10 mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "rgba(59,130,246,0.12)", boxShadow: "0 0 0 1px rgba(59,130,246,0.4)" }}>
            <Activity size={18} className="text-cyan-400" />
          </span>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
            Ads <span className="neon-text-cyan">Dashboard</span>
          </h1>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="glass-panel glass-panel-hover flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-200 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-cyan-400" : "text-cyan-400"} />
          {loading ? "Syncing…" : "Refresh"}
        </button>
      </header>

      {/* Filters */}
      <div className="glass-panel mb-6 flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1.5">
          <Layers size={14} className="text-slate-500 shrink-0" />
          <CustomSelect
            className="min-w-[150px]"
            value={platform}
            onChange={(v) => setPlatform(v as "both" | "meta" | "google")}
            options={[
              { value: "both", label: "Meta & Google", accent: true },
              { value: "meta", label: "Meta Only" },
              { value: "google", label: "Google Only" },
            ]}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Building2 size={14} className="text-slate-500 shrink-0" />
          <CustomSelect
            className="min-w-[160px]"
            value={business}
            onChange={setBusiness}
            options={[{ value: ALL, label: "All Businesses" }, ...businesses.map((b) => ({ value: b, label: b }))]}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Wallet2 size={14} className="text-slate-500 shrink-0" />
          <CustomSelect
            className="min-w-[170px]"
            value={account}
            onChange={setAccount}
            options={[
              { value: ALL_ACCOUNTS, label: "All Ad Accounts", accent: true },
              ...visibleAccounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <UserRound size={14} className="text-slate-500 shrink-0" />
          <CustomSelect
            className="min-w-[150px]"
            value={client}
            onChange={setClient}
            options={[{ value: ALL, label: "All Clients" }, ...clients.map((c) => ({ value: c, label: c }))]}
          />
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {error && (
        <div className="glass-panel mb-6 p-6" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: "rgba(251,191,36,0.12)" }}>
              <Activity size={18} className="text-amber-400" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-amber-300">No live data yet</h3>
              <p className="mt-1 text-xs text-slate-400">
                The dashboard shows real data only. It couldn&apos;t reach a connected ad account.
              </p>
              <p className="mt-2 rounded bg-white/[0.04] px-3 py-2 font-mono text-[11px] text-slate-400">{error}</p>
              <p className="mt-2 text-xs text-slate-500">
                Add <code className="text-cyan-300">META_ACCESS_TOKEN</code> to your environment, then click Refresh.
              </p>
            </div>
          </div>
        </div>
      )}

      {!error && (
      <>
      {/* KPI + Line chart row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-4 lg:col-span-1">
          {loading || !data ? (
            <SkeletonKpis />
          ) : (
            <>
              <KpiCard label="Total Spend" value={formatIDR(data.kpis.totalSpend)} icon={Wallet} accent="magenta" />
              <KpiCard label="Leads" value={formatNumber(data.kpis.leads)} icon={MessageCircle} accent="cyan" />
              <KpiCard label="Cost / Lead" value={formatIDR(data.kpis.costPerLead, false)} icon={Target} accent="violet" />
              <KpiCard label="CTR" value={formatPct(data.kpis.ctr)} icon={Percent} accent="blue" />
            </>
          )}
        </div>

        <Panel
          title="Ad Spend vs. Leads"
          subtitle="Daily spend and leads"
          className="lg:col-span-2"
          bodyClassName="h-[260px]"
          right={
            data && (
              <div className="text-right">
                <div className="neon-text-cyan text-lg font-black">{formatNumber(data.kpis.leads)}</div>
                <div className="text-[10px] text-slate-500">total leads</div>
              </div>
            )
          }
        >
          {loading || !data ? <SkeletonBlock /> : <SpendRevenueChart data={data.timeseries} />}
        </Panel>
      </div>

      {/* Donut + Bar row */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Spend by Campaign" subtitle="Top campaigns" bodyClassName="h-[320px]">
          {loading || !data ? <SkeletonBlock /> : <SourcesDonut data={data.sources} />}
        </Panel>

        <Panel
          title="Top Performing Campaigns"
          subtitle="Ranked by spend"
          className="lg:col-span-2"
          bodyClassName="h-[320px]"
        >
          {loading || !data ? <SkeletonBlock /> : <TopCampaignsBar data={data.topCampaigns} />}
        </Panel>
      </div>

      {/* Secondary KPI strip */}
      {data && !loading && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MiniStat label="Impressions" value={formatNumber(data.kpis.impressions)} />
          <MiniStat label="Clicks" value={formatNumber(data.kpis.clicks)} />
          <MiniStat label="Avg CPC" value={formatIDR(data.kpis.cpc, false)} />
          <MiniStat label="Lead Conv. Rate" value={data.kpis.clicks > 0 ? formatPct(data.kpis.leads / data.kpis.clicks) : "—"} />
        </div>
      )}
      </>
      )}

      {/* API flow */}
      <div className="mt-4">
        <ApiStatusFlow />
      </div>

      <footer className="mt-6 text-center text-[11px] text-slate-600">
        {data ? `Data generated ${new Date(data.generatedAt).toLocaleString("id-ID")}` : ""}
      </footer>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-slate-100">{value}</div>
    </div>
  );
}

function SkeletonKpis() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="glass-panel h-[104px] animate-pulse" />
      ))}
    </>
  );
}

function SkeletonBlock() {
  return <div className="h-full w-full animate-pulse rounded-xl bg-white/[0.03]" />;
}
