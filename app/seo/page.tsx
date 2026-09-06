"use client";

import { PiggyBank, MousePointer2, Target, TrendingUp, Sparkles } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import Panel from "@/components/Panel";
import TrafficOverlayChart from "@/components/seo/TrafficOverlayChart";
import IndexingHealth from "@/components/seo/IndexingHealth";
import { trafficSeries, dashboardKpis, indexing } from "@/lib/seo/mock";
import { formatIDR, formatNumber } from "@/lib/format";

export default function SeoDashboardPage() {
  const organicShare = Math.round(
    (dashboardKpis.organicSessions / (dashboardKpis.organicSessions + dashboardKpis.paidSessions)) * 100
  );

  return (
    <div className="flex flex-col gap-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Ad Spend Saved" value={formatIDR(dashboardKpis.adSpendSavedIDR)} delta="18.4%" deltaPositive icon={PiggyBank} accent="cyan" />
        <KpiCard label="Organic Sessions" value={formatNumber(dashboardKpis.organicSessions)} delta="12.1%" deltaPositive icon={MousePointer2} accent="blue" />
        <KpiCard label="Organic Conversions" value={formatNumber(dashboardKpis.organicConversions)} delta="6.7%" deltaPositive icon={Target} accent="violet" />
        <KpiCard label="Avg. Position" value={dashboardKpis.avgPosition.toFixed(1)} delta="1.3" deltaPositive icon={TrendingUp} accent="magenta" />
      </div>

      {/* Cost-saving highlight */}
      <div className="glass-panel flex flex-wrap items-center gap-x-8 gap-y-3 p-5" style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.2)" }}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "rgba(34,211,238,0.12)", boxShadow: "0 0 0 1px rgba(34,211,238,0.4)" }}>
            <Sparkles size={22} className="text-cyan-400" />
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-100">Paid ↔ Organic Synergy</div>
            <div className="text-xs text-slate-500">Organic rankings offsetting Meta ad spend, last 30 days</div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-x-8 gap-y-3">
          <Stat label="Est. spend saved" value={formatIDR(dashboardKpis.adSpendSavedIDR)} accent="#22d3ee" />
          <Stat label="Organic traffic share" value={`${organicShare}%`} accent="#8b5cf6" />
          <Stat label="Blended CPC avoided" value={formatIDR(dashboardKpis.organicClickValueIDR, false)} accent="#d946ef" />
        </div>
      </div>

      {/* Traffic overlay + indexing */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Organic vs. Paid Meta Traffic"
          subtitle="Daily sessions, last 30 days"
          className="lg:col-span-2"
          bodyClassName="h-[300px]"
          right={
            <div className="text-right">
              <div className="neon-text-cyan text-lg font-black">{formatNumber(dashboardKpis.organicSessions)}</div>
              <div className="text-[10px] text-slate-500">organic sessions</div>
            </div>
          }
        >
          <TrafficOverlayChart data={trafficSeries} />
        </Panel>

        <Panel title="Indexing Health" subtitle="Pages indexed vs. errors" bodyClassName="h-[300px]">
          <IndexingHealth
            indexed={indexing.indexed}
            discoveredNotIndexed={indexing.discoveredNotIndexed}
            errors404={indexing.errors404}
            crawlErrors={indexing.crawlErrors}
          />
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <div className="text-lg font-black" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}
