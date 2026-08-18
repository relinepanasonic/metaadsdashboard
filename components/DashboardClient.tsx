"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  Eye,
  MousePointerClick,
  MessageCircle,
  Target,
  Percent,
  RefreshCw,
  Activity,
} from "lucide-react";
import type { UnifiedDashboardData } from "@/lib/services/types";
import { formatIDR, formatNumber, formatPct } from "@/lib/format";
import KpiCard from "./KpiCard";
import Panel from "./Panel";
import SpendRevenueChart from "./SpendRevenueChart";
import SourcesDonut from "./SourcesDonut";
import TopCampaignsBar from "./TopCampaignsBar";
import ApiStatusFlow from "./ApiStatusFlow";

export default function DashboardClient() {
  const [data, setData] = useState<UnifiedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
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
  }, []);

  return (
    <div className="relative z-10 mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "rgba(59,130,246,0.12)", boxShadow: "0 0 0 1px rgba(59,130,246,0.4)" }}>
              <Activity size={18} className="text-cyan-400" />
            </span>
            <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              Unified Ads <span className="neon-text-cyan">Command Center</span>
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Meta Ads · Prof Toko Online · Last 30 days
          </p>
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
        <Panel title="Spend by Campaign" subtitle="Top Meta campaigns" bodyClassName="h-[320px]">
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
        {data ? `Data generated ${new Date(data.generatedAt).toLocaleString("id-ID")} · ` : ""}
        Live data — Meta Graph API (act_1153490826516966)
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
