"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PiggyBank, MousePointer2, Target, TrendingUp, Sparkles, Plug, Eye, Percent } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import Panel from "@/components/Panel";
import CustomSelect from "@/components/CustomSelect";
import TrafficOverlayChart from "@/components/seo/TrafficOverlayChart";
import IndexingHealth from "@/components/seo/IndexingHealth";
import MonthlyTrendChart, { type MonthlyRow } from "@/components/seo/MonthlyTrendChart";
import { trafficSeries, dashboardKpis, indexing } from "@/lib/seo/mock";
import { formatIDR, formatNumber, formatPct } from "@/lib/format";

interface SiteConnection {
  id: string;
  site_url: string;
  label: string;
  status: "pending" | "connected" | "error";
}

interface AnalyticsResponse {
  site: { url: string; label: string };
  daily: { date: string; clicks: number; impressions: number; ctr: number; position: number }[];
  monthly: MonthlyRow[];
  coverage: { indexed: number; notIndexed: number };
}

export default function SeoDashboardPage() {
  const [sites, setSites] = useState<SiteConnection[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loadingSites, setLoadingSites] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    fetch("/api/seo/gsc/sites", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          const connected = (j.sites as SiteConnection[]).filter((s) => s.status === "connected");
          setSites(connected);
          if (connected[0]) setSelected(connected[0].id);
        }
      })
      .finally(() => setLoadingSites(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoadingData(true);
    fetch(`/api/seo/gsc/analytics?siteId=${selected}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setData(j))
      .finally(() => setLoadingData(false));
  }, [selected]);

  const isLive = sites.length > 0;

  const liveKpis = useMemo(() => {
    if (!data) return null;
    const totals = data.daily.reduce(
      (a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }),
      { clicks: 0, impressions: 0 }
    );
    const avgPos = data.daily.length > 0
      ? data.daily.reduce((a, r) => a + r.position * r.impressions, 0) / Math.max(1, totals.impressions)
      : 0;
    return {
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
      avgPosition: avgPos,
    };
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      {/* Connection banner */}
      {!loadingSites && !isLive && (
        <div className="glass-panel flex flex-wrap items-center gap-3 p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
          <Plug size={18} className="text-amber-400" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-amber-300">You&apos;re viewing demo data</div>
            <div className="text-xs text-slate-400">Connect your website to Google Search Console to see real traffic, indexing, and month-over-month trends.</div>
          </div>
          <Link
            href="/seo/connect"
            className="ml-auto flex shrink-0 items-center gap-2 rounded-lg bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
            style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.4)" }}
          >
            Connect Now
          </Link>
        </div>
      )}

      {/* Site selector when live + more than one site */}
      {isLive && sites.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Website:</span>
          <CustomSelect value={selected} onChange={setSelected} options={sites.map((s) => ({ value: s.id, label: s.label }))} />
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLive ? (
          <>
            <KpiCard label="Organic Clicks" value={formatNumber(liveKpis?.clicks ?? 0)} icon={MousePointer2} accent="blue" />
            <KpiCard label="Impressions" value={formatNumber(liveKpis?.impressions ?? 0)} icon={Eye} accent="violet" />
            <KpiCard label="Avg. CTR" value={formatPct(liveKpis?.ctr ?? 0)} icon={Percent} accent="cyan" />
            <KpiCard label="Avg. Position" value={(liveKpis?.avgPosition ?? 0).toFixed(1)} icon={TrendingUp} accent="magenta" />
          </>
        ) : (
          <>
            <KpiCard label="Ad Spend Saved" value={formatIDR(dashboardKpis.adSpendSavedIDR)} delta="18.4%" deltaPositive icon={PiggyBank} accent="cyan" />
            <KpiCard label="Organic Sessions" value={formatNumber(dashboardKpis.organicSessions)} delta="12.1%" deltaPositive icon={MousePointer2} accent="blue" />
            <KpiCard label="Organic Conversions" value={formatNumber(dashboardKpis.organicConversions)} delta="6.7%" deltaPositive icon={Target} accent="violet" />
            <KpiCard label="Avg. Position" value={dashboardKpis.avgPosition.toFixed(1)} delta="1.3" deltaPositive icon={TrendingUp} accent="magenta" />
          </>
        )}
      </div>

      {!isLive && (
        <div className="glass-panel flex flex-wrap items-center gap-x-8 gap-y-3 p-5" style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.2)" }}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "rgba(34,211,238,0.12)", boxShadow: "0 0 0 1px rgba(34,211,238,0.4)" }}>
              <Sparkles size={22} className="text-cyan-400" />
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-100">Paid ↔ Organic Synergy</div>
              <div className="text-xs text-slate-500">Organic rankings offsetting Meta ad spend, last 30 days (demo)</div>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Est. spend saved" value={formatIDR(dashboardKpis.adSpendSavedIDR)} accent="#22d3ee" />
            <Stat label="Organic traffic share" value={`${Math.round((dashboardKpis.organicSessions / (dashboardKpis.organicSessions + dashboardKpis.paidSessions)) * 100)}%`} accent="#8b5cf6" />
            <Stat label="Blended CPC avoided" value={formatIDR(dashboardKpis.organicClickValueIDR, false)} accent="#d946ef" />
          </div>
        </div>
      )}

      {/* Month-over-month (live) or daily overlay (demo) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title={isLive ? "Month-over-Month Performance" : "Organic vs. Paid Meta Traffic"}
          subtitle={isLive ? `Clicks & average position by month — ${data?.site.label ?? ""}` : "Daily sessions, last 30 days (demo)"}
          className="lg:col-span-2"
          bodyClassName="h-[300px]"
          right={
            <div className="text-right">
              <div className="neon-text-cyan text-lg font-black">
                {isLive ? formatNumber(liveKpis?.clicks ?? 0) : formatNumber(dashboardKpis.organicSessions)}
              </div>
              <div className="text-[10px] text-slate-500">{isLive ? "total clicks (16mo)" : "organic sessions"}</div>
            </div>
          }
        >
          {isLive ? (
            loadingData ? (
              <div className="grid h-full place-items-center text-xs text-slate-500">Loading Search Console data…</div>
            ) : data && data.monthly.length > 0 ? (
              <MonthlyTrendChart data={data.monthly} />
            ) : (
              <div className="grid h-full place-items-center text-xs text-slate-500">No data yet for this range.</div>
            )
          ) : (
            <TrafficOverlayChart data={trafficSeries} />
          )}
        </Panel>

        <Panel title="Indexing Health" subtitle={isLive ? "From your sitemaps" : "Pages indexed vs. errors (demo)"} bodyClassName="h-[300px]">
          <IndexingHealth
            indexed={isLive ? (data?.coverage.indexed ?? 0) : indexing.indexed}
            discoveredNotIndexed={isLive ? (data?.coverage.notIndexed ?? 0) : indexing.discoveredNotIndexed}
            errors404={isLive ? 0 : indexing.errors404}
            crawlErrors={isLive ? 0 : indexing.crawlErrors}
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
