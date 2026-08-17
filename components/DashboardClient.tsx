"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  Eye,
  MousePointerClick,
  TrendingUp,
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
            Meta Ads + Google Ads · Prof Toko Online · Last 30 days
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
        <div className="glass-panel mb-6 border-rose-500/40 p-4 text-sm text-rose-300">
          Failed to load dashboard: {error}
        </div>
      )}

      {/* KPI + Line chart row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-4 lg:col-span-1">
          {loading || !data ? (
            <SkeletonKpis />
          ) : (
            <>
              <KpiCard label="Total Spend" value={formatIDR(data.kpis.totalSpend)} delta="8.2%" deltaPositive icon={Wallet} accent="cyan" />
              <KpiCard label="Impressions" value={formatNumber(data.kpis.impressions)} delta="12.5%" deltaPositive icon={Eye} accent="blue" />
              <KpiCard label="Clicks" value={formatNumber(data.kpis.clicks)} delta="4.1%" deltaPositive icon={MousePointerClick} accent="magenta" />
              <KpiCard label="ROAS" value={`${data.kpis.roas.toFixed(2)}x`} delta="0.3x" deltaPositive icon={TrendingUp} accent="violet" />
            </>
          )}
        </div>

        <Panel
          title="Ad Spend vs. Revenue"
          subtitle="Daily, combined across platforms"
          className="lg:col-span-2"
          bodyClassName="h-[260px]"
          right={
            data && (
              <div className="text-right">
                <div className="neon-text-cyan text-lg font-black">{formatIDR(data.kpis.revenue)}</div>
                <div className="text-[10px] text-slate-500">total revenue</div>
              </div>
            )
          }
        >
          {loading || !data ? <SkeletonBlock /> : <SpendRevenueChart data={data.timeseries} />}
        </Panel>
      </div>

      {/* Donut + Bar row */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Spend by Source" subtitle="Meta vs Google Ads" bodyClassName="h-[280px]">
          {loading || !data ? <SkeletonBlock /> : <SourcesDonut data={data.sources} />}
        </Panel>

        <Panel
          title="Top Performing Campaigns"
          subtitle="Ranked by revenue"
          className="lg:col-span-2"
          bodyClassName="h-[280px]"
        >
          {loading || !data ? <SkeletonBlock /> : <TopCampaignsBar data={data.topCampaigns} />}
        </Panel>
      </div>

      {/* Secondary KPI strip */}
      {data && !loading && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MiniStat label="Conversions" value={formatNumber(data.kpis.conversions)} />
          <MiniStat label="Avg CTR" value={formatPct(data.kpis.ctr)} />
          <MiniStat label="Avg CPC" value={formatIDR(data.kpis.cpc, false)} />
          <MiniStat label="Total Revenue" value={formatIDR(data.kpis.revenue)} />
        </div>
      )}

      {/* API flow */}
      <div className="mt-4">
        <ApiStatusFlow />
      </div>

      <footer className="mt-6 text-center text-[11px] text-slate-600">
        {data ? `Data generated ${new Date(data.generatedAt).toLocaleString("id-ID")} · ` : ""}
        Mock data — swap service files for live Meta Graph API & Google Ads SDK
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
