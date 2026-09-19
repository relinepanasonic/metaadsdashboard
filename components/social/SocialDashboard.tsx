"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Users, TrendingUp, Eye, UserCheck, MousePointerClick, RefreshCw, Loader2, AlertTriangle, ExternalLink, Filter, Camera, ThumbsUp, History } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import CustomSelect from "@/components/CustomSelect";
import { compactNumber, formatNumber } from "@/lib/format";

interface Snapshot {
  snapshot_date: string;
  followers_count: number | null;
  reach: number | null;
  views: number | null;
  profile_views: number | null;
  accounts_engaged: number | null;
  total_interactions: number | null;
}

interface Post {
  media_id: string;
  caption: string | null;
  media_type: string | null;
  permalink: string | null;
  posted_at: string | null;
  like_count: number | null;
  comments_count: number | null;
}

interface Demo {
  audience: "followers" | "engaged";
  breakdown: "age" | "gender" | "city" | "country";
  key: string;
  value: number;
  month: string;
}

interface Account {
  accountId: string;
  clientId: string;
  clientName: string;
  platform: "instagram" | "facebook";
  handle: string | null;
  externalId: string;
  snapshots: Snapshot[];
  posts: Post[];
  demographics: Demo[];
}

interface Status {
  ok: boolean;
  configured?: boolean;
  ready?: boolean;
  missing?: string[];
  error?: string;
}

type MetricKey = "reach" | "views" | "profile_views" | "accounts_engaged" | "total_interactions";

const DAY = 86_400_000;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoDaysAgo(n: number): string {
  return iso(new Date(Date.now() - n * DAY));
}

function shift(date: string, days: number): string {
  return iso(new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY));
}

function spanDays(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY) + 1;
}

interface Window {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  label: string;
}

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_ID[m - 1]} ${y}`;
}

// "7" / "30" = that many days ending yesterday, compared with the same number
// of days before. "YYYY-MM" = that calendar month (up to yesterday if it is
// still running), compared with the same number of days at the start of the
// previous month so a half-finished month isn't judged against a full one.
function windowFor(range: string): Window {
  const yesterday = isoDaysAgo(1);

  if (/^\d{4}-\d{2}$/.test(range)) {
    const [y, m] = range.split("-").map(Number);
    const from = `${range}-01`;
    const monthEnd = iso(new Date(Date.UTC(y, m, 0)));
    const to = monthEnd > yesterday ? yesterday : monthEnd;
    const len = spanDays(from, to);

    const prevFrom = iso(new Date(Date.UTC(y, m - 2, 1)));
    const prevMonthEnd = iso(new Date(Date.UTC(y, m - 1, 0)));
    const prevTo = len <= 0 ? shift(prevFrom, -1) : shift(prevFrom, len - 1) > prevMonthEnd ? prevMonthEnd : shift(prevFrom, len - 1);
    return { from, to, prevFrom, prevTo, label: monthLabel(range) };
  }

  const n = Number(range);
  const from = isoDaysAgo(n);
  const prevTo = shift(from, -1);
  return { from, to: yesterday, prevFrom: shift(prevTo, -(n - 1)), prevTo, label: `last ${n} days` };
}

function pctChange(now: number, before: number): string | null {
  if (before <= 0) return null;
  const p = ((now - before) / before) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

function sum(accounts: Account[], from: string, to: string, key: MetricKey): number {
  let total = 0;
  for (const a of accounts) for (const s of a.snapshots) if (s.snapshot_date >= from && s.snapshot_date <= to) total += s[key] ?? 0;
  return total;
}

function hasInsights(a: Account): boolean {
  return a.snapshots.some((s) => s.reach != null);
}

const accountLabel = (a: Account) => `${a.handle || a.externalId} · ${a.platform === "instagram" ? "IG" : "FB"}`;

export default function SocialDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [range, setRange] = useState("30");
  const [audience, setAudience] = useState<"followers" | "engaged">("followers");
  const autoSyncedRef = useRef(false);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/social/stats", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/instagram/status", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([stats, st]) => {
        if (stats.ok) setAccounts(stats.accounts);
        setStatus(st);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The daily job (09:30 WIB) normally keeps everything current. If nothing
  // newer than the day before yesterday is stored — a missed run, or the first
  // visit after linking accounts — refresh quietly once when the page opens.
  useEffect(() => {
    if (loading || autoSyncedRef.current || accounts.length === 0) return;
    autoSyncedRef.current = true;
    const newest = accounts.flatMap((a) => a.snapshots.map((s) => s.snapshot_date)).sort().pop();
    if (newest && newest >= isoDaysAgo(1)) return;

    setAutoSyncing(true);
    fetch("/api/social/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: 7 }) })
      .catch(() => null)
      .finally(() => {
        setAutoSyncing(false);
        load();
      });
  }, [loading, accounts, load]);

  async function syncNow(days: number) {
    setSyncing(true);
    setSyncMsg(null);
    const res = await fetch("/api/social/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: clientFilter === "all" ? undefined : clientFilter, days }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Request failed" }));
    setSyncing(false);

    if (!res.ok) {
      setSyncMsg({ ok: false, text: res.error });
      return;
    }
    const results = res.results as { client: string; account: string; summary?: string; error?: string }[];
    setSyncMsg({
      ok: !results.some((r) => r.error),
      text: results.map((r) => (r.error ? `${r.client} / ${r.account}: ${r.error}` : `${r.client} / ${r.account}: ${r.summary}`)).join(" · "),
    });
    load();
  }

  const clientOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of accounts) seen.set(a.clientId, a.clientName);
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [accounts]);

  // Account list narrows with the client and platform picked above it.
  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a) => (clientFilter === "all" || a.clientId === clientFilter) && (platformFilter === "all" || a.platform === platformFilter))
        .map((a) => ({ value: a.accountId, label: accountLabel(a) })),
    [accounts, clientFilter, platformFilter]
  );

  const selected = useMemo(
    () =>
      accounts.filter(
        (a) =>
          (clientFilter === "all" || a.clientId === clientFilter) &&
          (platformFilter === "all" || a.platform === platformFilter) &&
          (accountFilter === "all" || a.accountId === accountFilter)
      ),
    [accounts, clientFilter, platformFilter, accountFilter]
  );

  const win = useMemo(() => windowFor(range), [range]);

  // Last 7 / 30 days, then Januari–Desember of this year, then any earlier
  // month that already has stored data.
  const durationOptions = useMemo(() => {
    const year = new Date().getUTCFullYear();
    const opts = [
      { value: "7", label: "Last 7 days" },
      { value: "30", label: "Last 30 days" },
      ...MONTHS_ID.map((name, i) => ({ value: `${year}-${String(i + 1).padStart(2, "0")}`, label: `${name} ${year}` })),
    ];
    const listed = new Set(opts.map((o) => o.value));
    const earlier = new Set<string>();
    for (const a of accounts) for (const s of a.snapshots) if (!listed.has(s.snapshot_date.slice(0, 7))) earlier.add(s.snapshot_date.slice(0, 7));
    [...earlier].sort().reverse().forEach((ym) => opts.push({ value: ym, label: monthLabel(ym) }));
    return opts;
  }, [accounts]);

  const dataThrough = useMemo(() => selected.flatMap((a) => a.snapshots.map((s) => s.snapshot_date)).sort().pop() ?? null, [selected]);
  const insightsAvailable = selected.some(hasInsights);

  const kpis = useMemo(() => {
    const metric = (key: MetricKey) => {
      const now = sum(selected, win.from, win.to, key);
      return { value: now, change: pctChange(now, sum(selected, win.prevFrom, win.prevTo, key)) };
    };

    let followers = 0;
    let followerDelta = 0;
    let hasDelta = false;
    for (const a of selected) {
      const pts = a.snapshots.filter((s) => s.followers_count != null);
      if (pts.length === 0) continue;
      followers += pts[pts.length - 1].followers_count ?? 0;
      const inRange = pts.filter((s) => s.snapshot_date >= win.from);
      if (inRange.length >= 2) {
        followerDelta += (inRange[inRange.length - 1].followers_count ?? 0) - (inRange[0].followers_count ?? 0);
        hasDelta = true;
      }
    }

    return {
      followers,
      followerDelta: hasDelta ? followerDelta : null,
      reach: metric("reach"),
      views: metric("views"),
      profileViews: metric("profile_views"),
      engaged: metric("accounts_engaged"),
    };
  }, [selected, win]);

  const series = useMemo(() => {
    const byDate = new Map<string, { date: string; reach: number; views: number }>();
    for (const a of selected)
      for (const s of a.snapshots) {
        if (s.snapshot_date < win.from || s.snapshot_date > win.to || s.reach == null) continue;
        const row = byDate.get(s.snapshot_date) ?? { date: s.snapshot_date, reach: 0, views: 0 };
        row.reach += s.reach ?? 0;
        row.views += s.views ?? 0;
        byDate.set(s.snapshot_date, row);
      }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ ...r, label: r.date.slice(5) }));
  }, [selected, win]);

  // Month by month uses everything stored, independent of the Duration filter.
  const monthly = useMemo(() => {
    interface Row {
      month: string;
      reach: number;
      views: number;
      profile: number;
      engaged: number;
      interactions: number;
      insights: boolean;
      followers: Map<string, { date: string; value: number }>;
    }
    const map = new Map<string, Row>();
    for (const a of selected)
      for (const s of a.snapshots) {
        const m = s.snapshot_date.slice(0, 7);
        const row = map.get(m) ?? { month: m, reach: 0, views: 0, profile: 0, engaged: 0, interactions: 0, insights: false, followers: new Map() };
        if (s.reach != null) row.insights = true;
        row.reach += s.reach ?? 0;
        row.views += s.views ?? 0;
        row.profile += s.profile_views ?? 0;
        row.engaged += s.accounts_engaged ?? 0;
        row.interactions += s.total_interactions ?? 0;
        if (s.followers_count != null) {
          const cur = row.followers.get(a.accountId);
          if (!cur || s.snapshot_date > cur.date) row.followers.set(a.accountId, { date: s.snapshot_date, value: s.followers_count });
        }
        map.set(m, row);
      }

    const rows = [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
    return rows.map((r, i) => {
      const followers = [...r.followers.values()].reduce((t, f) => t + f.value, 0);
      const prev = i > 0 ? rows[i - 1] : null;
      const prevFollowers = prev ? [...prev.followers.values()].reduce((t, f) => t + f.value, 0) : 0;
      return {
        ...r,
        followersEnd: r.followers.size > 0 ? followers : null,
        followerGrowth: prev && r.followers.size > 0 && prev.followers.size > 0 ? followers - prevFollowers : null,
        reachChange: prev && r.insights && prev.insights ? pctChange(r.reach, prev.reach) : null,
        label: monthLabel(r.month),
        partial: r.month === isoDaysAgo(1).slice(0, 7),
      };
    });
  }, [selected]);

  const topPosts = useMemo(() => {
    const cutoff = `${win.from}T00:00:00Z`;
    return selected
      .flatMap((a) => a.posts.filter((p) => p.posted_at && p.posted_at >= cutoff && p.posted_at <= `${win.to}T23:59:59Z`).map((p) => ({ ...p, account: a.handle || a.clientName })))
      .sort((a, b) => (b.like_count ?? 0) + (b.comments_count ?? 0) - ((a.like_count ?? 0) + (a.comments_count ?? 0)))
      .slice(0, 10);
  }, [selected, win]);

  // Audience: summed across the selected Instagram accounts that have a reading.
  const audienceData = useMemo(() => {
    const ig = selected.filter((a) => a.platform === "instagram");
    const has = (a: Account) => a.demographics.some((d) => d.audience === audience);
    const withData = ig.filter(has);
    const sumBy = (b: Demo["breakdown"]) => {
      const m = new Map<string, number>();
      for (const a of withData) for (const d of a.demographics) if (d.audience === audience && d.breakdown === b) m.set(d.key, (m.get(d.key) ?? 0) + d.value);
      return m;
    };
    return {
      age: slices(sumBy("age"), (k) => k, AGE_ORDER),
      gender: slices(sumBy("gender"), (k) => GENDER_LABEL[k] ?? k),
      city: slices(sumBy("city"), (k) => k.split(",")[0], undefined, 10),
      country: slices(sumBy("country"), regionName, undefined, 10),
      withData,
      without: ig.filter((a) => !has(a)),
      month: withData.flatMap((a) => a.demographics.map((d) => d.month)).sort().pop() ?? null,
    };
  }, [selected, audience]);

  const hasData = accounts.some((a) => a.snapshots.length > 0);
  const setupNeeded = status && (!status.ok || !status.configured || !status.ready);
  const dash = "—";

  if (loading) return <div className="glass-panel p-6 text-center text-xs text-slate-500">Loading social data&hellip;</div>;

  return (
    <div className="flex flex-col gap-4">
      {setupNeeded && (
        <div className="glass-panel flex items-start gap-3 p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="min-w-0 text-xs text-slate-400">
            <div className="text-sm font-semibold text-amber-300">Instagram insights aren&apos;t unlocked yet</div>
            {status?.error ? (
              <div className="mt-1">Couldn&apos;t check the token: {status.error}</div>
            ) : (
              <div className="mt-1">
                Until then only follower counts are saved — reach, views, profile visits and posts stay empty. The token is missing <strong className="text-slate-300">{(status?.missing ?? ["instagram_basic", "instagram_manage_insights"]).join(", ")}</strong>. Add them to the Meta app, assign the token&apos;s user to each Instagram account in Business Settings, update <code className="rounded bg-white/[0.06] px-1">META_ACCESS_TOKEN</code> in Vercel, then use <strong className="text-slate-300">Backfill 90 days</strong>.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters: Client | Platform | Account | Duration */}
      <div className="glass-panel flex flex-wrap items-center gap-3 p-3">
        <Filter size={14} className="shrink-0 text-cyan-400" />
        <CustomSelect
          className="min-w-[160px]"
          value={clientFilter}
          onChange={(v) => {
            setClientFilter(v);
            setAccountFilter("all");
          }}
          options={[{ value: "all", label: "All clients", accent: true }, ...clientOptions]}
        />
        <CustomSelect
          className="min-w-[140px]"
          value={platformFilter}
          onChange={(v) => {
            setPlatformFilter(v);
            setAccountFilter("all");
          }}
          options={[
            { value: "all", label: "All platforms" },
            { value: "instagram", label: "Instagram" },
            { value: "facebook", label: "Facebook" },
          ]}
        />
        <CustomSelect
          className="min-w-[190px]"
          value={accountFilter}
          onChange={setAccountFilter}
          options={[{ value: "all", label: "All accounts" }, ...accountOptions]}
        />
        <CustomSelect
          className="min-w-[150px]"
          value={range}
          onChange={setRange}
          options={durationOptions}
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => syncNow(30)}
            disabled={syncing || accounts.length === 0}
            className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.1] disabled:opacity-50"
          >
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sync 30 days
          </button>
          <button
            onClick={() => syncNow(90)}
            disabled={syncing || accounts.length === 0}
            className="flex items-center gap-2 rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
            title="Pulls everything Meta still returns (about 90 days) and stores it permanently"
          >
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />} Backfill 90 days
          </button>
        </div>
      </div>

      <div className="-mt-2 flex flex-wrap items-center gap-1.5 px-1 text-[10px] text-slate-500">
        {autoSyncing ? (
          <>
            <Loader2 size={10} className="animate-spin" /> Updating from Instagram…
          </>
        ) : dataThrough ? (
          <>Data saved through {dataThrough}.</>
        ) : (
          <>No data saved yet.</>
        )}
        <span>It updates by itself every day at 09:30 WIB and is kept permanently in our database, so the month-by-month history keeps growing — no need to press Sync.</span>
      </div>

      {syncMsg && (
        <div
          className={`glass-panel p-3 text-xs ${syncMsg.ok ? "text-emerald-300" : "text-rose-300"}`}
          style={{ boxShadow: `inset 0 0 0 1px ${syncMsg.ok ? "rgba(52,211,153,0.3)" : "rgba(251,113,133,0.3)"}` }}
        >
          {syncMsg.text}
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <Users size={28} className="mx-auto mb-3 text-slate-600" />
          <div className="text-sm font-semibold text-slate-300">No Instagram accounts or Facebook Pages linked to clients yet</div>
          <div className="mt-1 text-xs text-slate-500">
            Open <Link href="/clients" className="text-cyan-300 hover:underline">Clients</Link> and click <strong className="text-slate-300">Add accounts</strong> on a client — each client can have as many as it needs.
          </div>
        </div>
      ) : !hasData ? (
        <div className="glass-panel p-8 text-center text-xs text-slate-500">
          {accounts.length} account{accounts.length === 1 ? "" : "s"} linked, but no data stored yet. Click <strong className="text-slate-300">Sync 30 days</strong> to start.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Kpi label="Followers" icon={Users} color="text-blue-400" value={formatNumber(kpis.followers)} change={kpis.followerDelta != null ? `${kpis.followerDelta >= 0 ? "+" : ""}${formatNumber(kpis.followerDelta)}` : null} />
            <Kpi label="Reach" icon={TrendingUp} color="text-emerald-400" value={insightsAvailable ? compactNumber(kpis.reach.value) : dash} change={insightsAvailable ? kpis.reach.change : null} />
            <Kpi label="Views" icon={Eye} color="text-violet-400" value={insightsAvailable ? compactNumber(kpis.views.value) : dash} change={insightsAvailable ? kpis.views.change : null} />
            <Kpi label="Profile visits" icon={UserCheck} color="text-amber-400" value={insightsAvailable ? compactNumber(kpis.profileViews.value) : dash} change={insightsAvailable ? kpis.profileViews.change : null} />
            <Kpi label="Accounts engaged" icon={MousePointerClick} color="text-rose-400" value={insightsAvailable ? compactNumber(kpis.engaged.value) : dash} change={insightsAvailable ? kpis.engaged.change : null} />
          </div>
          <div className="-mt-2 text-[10px] text-slate-600">
            Showing {win.label} ({win.from} to {win.to}); changes compare with {win.prevFrom} to {win.prevTo}. Reach is summed per day, so a person reached on several days counts each day. Facebook Pages add followers only for now.
            {!insightsAvailable && " “—” means no insights are stored for the selected accounts yet (see the account table below)."}
          </div>

          <div className="glass-panel p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">Reach &amp; views per day</h3>
            <div className="h-[260px]">
              {!insightsAvailable ? (
                <div className="grid h-full place-items-center text-xs text-slate-500">No daily insights stored for the selected accounts yet.</div>
              ) : (
                mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,160,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#7c8bb0", fontSize: 11 }} axisLine={{ stroke: "rgba(120,160,255,0.15)" }} tickLine={false} />
                      <YAxis tick={{ fill: "#7c8bb0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => compactNumber(v as number)} width={44} />
                      <Tooltip
                        formatter={(value, name) => [formatNumber(Number(value) || 0), name === "reach" ? "Reach" : "Views"]}
                        labelStyle={{ color: "#e5e9f0" }}
                        itemStyle={{ color: "#e5e9f0" }}
                        contentStyle={{ background: "#11151f", border: "1px solid rgba(255,255,255,0.12)" }}
                      />
                      <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, color: "#9fb0d0", paddingBottom: 8 }} formatter={(v) => (v === "reach" ? "Reach" : "Views")} />
                      <Line type="monotone" dataKey="reach" stroke="#34d399" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="views" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )
              )}
            </div>
          </div>

          {/* Month by month — every day ever stored, not limited to Meta's ~90 days */}
          <div className="glass-panel p-4 sm:p-5">
            <div className="mb-1 flex flex-wrap items-baseline gap-2">
              <h3 className="text-sm font-semibold text-slate-100">Month by month</h3>
              <span className="text-[10px] text-slate-500">Built from every day saved in our database, so it keeps growing past the 90 days Meta returns. Follows the client, platform and account filters above.</span>
            </div>

            {monthly.length > 0 && insightsAvailable && (
              <div className="mb-4 h-[220px]">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly.slice(-12)} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,160,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#7c8bb0", fontSize: 11 }} axisLine={{ stroke: "rgba(120,160,255,0.15)" }} tickLine={false} />
                      <YAxis tick={{ fill: "#7c8bb0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => compactNumber(v as number)} width={44} />
                      <Tooltip
                        formatter={(value, name) => [formatNumber(Number(value) || 0), name === "reach" ? "Reach" : "Views"]}
                        labelStyle={{ color: "#e5e9f0" }}
                        itemStyle={{ color: "#e5e9f0" }}
                        contentStyle={{ background: "#11151f", border: "1px solid rgba(255,255,255,0.12)" }}
                      />
                      <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, color: "#9fb0d0", paddingBottom: 8 }} formatter={(v) => (v === "reach" ? "Reach" : "Views")} />
                      <Bar dataKey="reach" fill="#34d399" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="views" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2.5 font-semibold">Month</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Followers (end)</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Growth</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Reach</th>
                    <th className="px-3 py-2.5 text-right font-semibold">vs prev.</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Views</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Profile visits</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Engaged</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Interactions</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-slate-500">No stored data for the selected accounts yet.</td>
                    </tr>
                  ) : (
                    [...monthly].reverse().map((m) => (
                      <tr key={m.month} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 font-semibold text-slate-100">
                          {m.label}
                          {m.partial && <span className="ml-1.5 text-[10px] font-normal text-slate-500">so far</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-200">{m.followersEnd != null ? formatNumber(m.followersEnd) : dash}</td>
                        <td className={`px-3 py-2.5 text-right ${m.followerGrowth == null ? "text-slate-600" : m.followerGrowth >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {m.followerGrowth == null ? dash : `${m.followerGrowth >= 0 ? "+" : ""}${formatNumber(m.followerGrowth)}`}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-300">{m.insights ? formatNumber(m.reach) : dash}</td>
                        <td className={`px-3 py-2.5 text-right ${m.reachChange == null ? "text-slate-600" : m.reachChange.startsWith("-") ? "text-rose-400" : "text-emerald-400"}`}>{m.reachChange ?? dash}</td>
                        <td className="px-3 py-2.5 text-right text-slate-300">{m.insights ? formatNumber(m.views) : dash}</td>
                        <td className="px-3 py-2.5 text-right text-slate-300">{m.insights ? formatNumber(m.profile) : dash}</td>
                        <td className="px-3 py-2.5 text-right text-slate-300">{m.insights ? formatNumber(m.engaged) : dash}</td>
                        <td className="px-3 py-2.5 text-right text-slate-300">{m.insights ? formatNumber(m.interactions) : dash}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audience demographics — Instagram only, needs 100+ followers */}
          <div className="glass-panel p-4 sm:p-5">
            <div className="mb-1 flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-100">Audience</h3>
              <div className="flex rounded-lg bg-white/[0.05] p-0.5 text-[11px] font-semibold">
                {(["followers", "engaged"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAudience(a)}
                    className={`rounded-md px-3 py-1 ${audience === a ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    {a === "followers" ? "Followers" : "Engaged audience"}
                  </button>
                ))}
              </div>
              {audienceData.month && <span className="text-[10px] text-slate-500">Latest reading: {monthLabel(audienceData.month)}</span>}
            </div>
            <div className="mb-4 text-[10px] text-slate-500">
              Age, gender, city and country of {audience === "followers" ? "the people who follow" : "the people who engaged with"} the selected Instagram accounts. Instagram only provides this for accounts with 100+ followers, and only as a current picture, so we save one reading a month. Percentages are shares of the people Instagram could place.
            </div>

            {audienceData.withData.length === 0 ? (
              <div className="rounded-lg bg-white/[0.03] p-6 text-center text-xs text-slate-500">
                No audience data stored for the selected accounts yet. It appears after the next sync for accounts with 100+ followers.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ChartBlock title="Age">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={audienceData.age} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,160,255,0.08)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "#7c8bb0", fontSize: 11 }} axisLine={{ stroke: "rgba(120,160,255,0.15)" }} tickLine={false} />
                        <YAxis tick={{ fill: "#7c8bb0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v))}%`} width={40} />
                        <Tooltip {...tooltipStyle} formatter={sliceTooltip} />
                        <Bar dataKey="pct" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartBlock>

                <ChartBlock title="Gender">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={audienceData.gender} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                          {audienceData.gender.map((g) => (
                            <Cell key={g.name} fill={GENDER_COLOR[g.name] ?? "#a78bfa"} />
                          ))}
                        </Pie>
                        <Tooltip {...tooltipStyle} formatter={sliceTooltip} />
                        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, color: "#9fb0d0" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </ChartBlock>

                <ChartBlock title="Top cities" tall>
                  {mounted && <HorizontalBars data={audienceData.city} color="#34d399" />}
                </ChartBlock>

                <ChartBlock title="Top countries" tall>
                  {mounted && <HorizontalBars data={audienceData.country} color="#8b5cf6" />}
                </ChartBlock>
              </div>
            )}

            {audienceData.without.length > 0 && (
              <div className="mt-4 text-[10px] text-amber-400/80">
                No audience data for {audienceData.without.map((a) => a.handle || a.externalId).join(", ")} — Instagram provides demographics only for accounts with 100+ followers.
              </div>
            )}
          </div>

          <div className="glass-panel overflow-x-auto p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">By account ({win.label})</h3>
            <table className="w-full min-w-[820px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Account</th>
                  <th className="px-3 py-2.5 font-semibold">Client</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Followers</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Reach</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Views</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Profile visits</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Engaged</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Interactions</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((a) => {
                  const one = [a];
                  const ins = hasInsights(a);
                  const lastFollowers = [...a.snapshots].reverse().find((s) => s.followers_count != null)?.followers_count;
                  return (
                    <tr key={a.accountId} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-100">
                          {a.platform === "instagram" ? <Camera size={12} className="text-pink-400" /> : <ThumbsUp size={12} className="text-blue-400" />}
                          {a.handle || a.externalId}
                        </span>
                        {!ins && (
                          <div className="mt-0.5 text-[10px] text-amber-400/80">
                            {a.platform === "instagram" ? "Insights blocked — token needs instagram_manage_insights" : "Followers only — Facebook reach isn't connected"}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">{a.clientName}</td>
                      <td className="px-3 py-2.5 text-right text-slate-200">{lastFollowers != null ? formatNumber(lastFollowers) : dash}</td>
                      {(["reach", "views", "profile_views", "accounts_engaged", "total_interactions"] as MetricKey[]).map((k) => (
                        <td key={k} className="px-3 py-2.5 text-right text-slate-300">{ins ? formatNumber(sum(one, win.from, win.to, k)) : dash}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="glass-panel overflow-x-auto p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">Top posts ({win.label})</h3>
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Account</th>
                  <th className="px-3 py-2.5 font-semibold">Post</th>
                  <th className="px-3 py-2.5 font-semibold">Type</th>
                  <th className="px-3 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Likes</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Comments</th>
                </tr>
              </thead>
              <tbody>
                {topPosts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">No posts stored for this range. Posts need the Instagram permission described above.</td>
                  </tr>
                ) : (
                  topPosts.map((p) => (
                    <tr key={p.media_id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 text-slate-400">{p.account}</td>
                      <td className="max-w-[340px] px-3 py-2.5">
                        {p.permalink ? (
                          <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-100 hover:text-cyan-300">
                            <span className="truncate">{(p.caption ?? "(no caption)").slice(0, 80)}</span>
                            <ExternalLink size={10} className="shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-100">{(p.caption ?? "(no caption)").slice(0, 80)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">{p.media_type?.replace("_", " ").toLowerCase() ?? dash}</td>
                      <td className="px-3 py-2.5 text-slate-400">{p.posted_at?.slice(0, 10) ?? dash}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{p.like_count != null ? formatNumber(p.like_count) : dash}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{p.comments_count != null ? formatNumber(p.comments_count) : dash}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

interface Slice {
  name: string;
  full: string;
  value: number;
  pct: number;
}

const AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const GENDER_LABEL: Record<string, string> = { F: "Female", M: "Male", U: "Unspecified" };
const GENDER_COLOR: Record<string, string> = { Female: "#f472b6", Male: "#60a5fa", Unspecified: "#94a3b8" };

function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// Turns raw counts into chart slices. Percentages are taken against everything
// Instagram returned, so "top 10 cities" still shows each city's true share.
function slices(map: Map<string, number>, label: (k: string) => string, order?: string[], top?: number): Slice[] {
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  const rank = (k: string) => (order && order.includes(k) ? order.indexOf(k) : 99);
  let entries = [...map.entries()];
  entries = order ? entries.sort((a, b) => rank(a[0]) - rank(b[0])) : entries.sort((a, b) => b[1] - a[1]);
  if (top) entries = entries.slice(0, top);
  return entries.map(([k, v]) => ({ name: label(k), full: k, value: v, pct: total ? (v / total) * 100 : 0 }));
}

const tooltipStyle = {
  labelStyle: { color: "#e5e9f0" },
  itemStyle: { color: "#e5e9f0" },
  contentStyle: { background: "#11151f", border: "1px solid rgba(255,255,255,0.12)" },
};

// Recharts hands the tooltip both the plotted value and the original slice.
const sliceTooltip = (value: unknown, _name: unknown, item: unknown): [string, string] => {
  const s = (item as { payload?: Slice }).payload;
  return [`${s ? formatNumber(s.value) : ""} (${Number(s?.pct ?? value).toFixed(1)}%)`, "People"];
};

function ChartBlock({ title, tall, children }: { title: string; tall?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-slate-300">{title}</div>
      <div className={tall ? "h-[300px]" : "h-[240px]"}>{children}</div>
    </div>
  );
}

function HorizontalBars({ data, color }: { data: Slice[]; color: string }) {
  if (data.length === 0) return <div className="grid h-full place-items-center text-xs text-slate-500">No data</div>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,160,255,0.08)" horizontal={false} />
        <XAxis type="number" tick={{ fill: "#7c8bb0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v))}%`} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fill: "#9fb0d0", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} formatter={sliceTooltip} />
        <Bar dataKey="pct" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Kpi({ label, value, change, icon: Icon, color }: { label: string; value: string; change: string | null; icon: typeof Users; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0f141e] p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <Icon size={16} className={color} />
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {change && <span className={`text-xs font-semibold ${change.startsWith("-") ? "text-rose-400" : "text-emerald-400"}`}>{change}</span>}
      </div>
    </div>
  );
}
