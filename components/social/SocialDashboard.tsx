"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, TrendingUp, Eye, UserCheck, MousePointerClick, RefreshCw, Loader2, AlertTriangle, ExternalLink, Filter } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import CustomSelect from "@/components/CustomSelect";
import { compactNumber, formatNumber } from "@/lib/format";

interface Snapshot {
  ig_user_id: string;
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

interface Account {
  clientId: string;
  clientName: string;
  handle: string | null;
  igUserId: string;
  snapshots: Snapshot[];
  posts: Post[];
}

interface Status {
  ok: boolean;
  configured?: boolean;
  ready?: boolean;
  missing?: string[];
  error?: string;
}

type MetricKey = "reach" | "views" | "profile_views" | "accounts_engaged" | "total_interactions";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function sum(accounts: Account[], from: string, to: string, key: MetricKey): number {
  let total = 0;
  for (const a of accounts) for (const s of a.snapshots) if (s.snapshot_date >= from && s.snapshot_date <= to) total += s[key] ?? 0;
  return total;
}

function pctChange(now: number, before: number): string | null {
  if (before <= 0) return null;
  const p = ((now - before) / before) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

export default function SocialDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState("all");
  const [range, setRange] = useState("30");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/instagram/stats", { cache: "no-store" }).then((r) => r.json()),
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

  async function syncNow() {
    setSyncing(true);
    setSyncMsg(null);
    const res = await fetch("/api/instagram/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: clientFilter === "all" ? undefined : clientFilter, days: 30 }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Request failed" }));
    setSyncing(false);

    if (!res.ok) {
      setSyncMsg({ ok: false, text: res.error });
      return;
    }
    const lines = (res.results as { client: string; daysStored?: number; postsStored?: number; error?: string; errors?: string[] }[]).map((r) =>
      r.error ? `${r.client}: ${r.error}` : `${r.client}: ${r.daysStored} days, ${r.postsStored} posts${r.errors?.length ? ` (${r.errors[0]})` : ""}`
    );
    const failed = (res.results as { error?: string }[]).some((r) => r.error);
    setSyncMsg({ ok: !failed, text: lines.join(" · ") });
    load();
  }

  const days = Number(range);
  const selected = useMemo(() => (clientFilter === "all" ? accounts : accounts.filter((a) => a.clientId === clientFilter)), [accounts, clientFilter]);

  const win = useMemo(
    () => ({ from: isoDaysAgo(days), to: isoDaysAgo(1), prevFrom: isoDaysAgo(days * 2), prevTo: isoDaysAgo(days + 1) }),
    [days]
  );

  const kpis = useMemo(() => {
    const metric = (key: MetricKey) => {
      const now = sum(selected, win.from, win.to, key);
      const before = sum(selected, win.prevFrom, win.prevTo, key);
      return { value: now, change: pctChange(now, before) };
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
        if (s.snapshot_date < win.from || s.snapshot_date > win.to) continue;
        const row = byDate.get(s.snapshot_date) ?? { date: s.snapshot_date, reach: 0, views: 0 };
        row.reach += s.reach ?? 0;
        row.views += s.views ?? 0;
        byDate.set(s.snapshot_date, row);
      }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ ...r, label: r.date.slice(5) }));
  }, [selected, win]);

  const topPosts = useMemo(() => {
    const cutoff = `${win.from}T00:00:00Z`;
    return selected
      .flatMap((a) => a.posts.filter((p) => p.posted_at && p.posted_at >= cutoff).map((p) => ({ ...p, account: a.handle || a.clientName })))
      .sort((a, b) => (b.like_count ?? 0) + (b.comments_count ?? 0) - ((a.like_count ?? 0) + (a.comments_count ?? 0)))
      .slice(0, 10);
  }, [selected, win]);

  const hasData = accounts.some((a) => a.snapshots.length > 0);
  const setupNeeded = status && (!status.ok || !status.configured || !status.ready);

  if (loading) return <div className="glass-panel p-6 text-center text-xs text-slate-500">Loading Instagram data&hellip;</div>;

  return (
    <div className="flex flex-col gap-4">
      {setupNeeded && (
        <div className="glass-panel flex items-start gap-3 p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="min-w-0 text-xs text-slate-400">
            <div className="text-sm font-semibold text-amber-300">Instagram isn&apos;t connected to the Meta token yet</div>
            {status?.error ? (
              <div className="mt-1">Couldn&apos;t check the token: {status.error}</div>
            ) : (
              <div className="mt-1">
                The token is missing <strong className="text-slate-300">{(status?.missing ?? ["instagram_basic", "instagram_manage_insights"]).join(", ")}</strong>. Add them to the Meta app, assign the token&apos;s user to each Instagram account in Business Settings, then update <code className="rounded bg-white/[0.06] px-1">META_ACCESS_TOKEN</code> in Vercel.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters + sync */}
      <div className="glass-panel flex flex-wrap items-center gap-3 p-3">
        <Filter size={14} className="shrink-0 text-cyan-400" />
        <CustomSelect
          className="min-w-[180px]"
          value={clientFilter}
          onChange={setClientFilter}
          options={[{ value: "all", label: "All accounts", accent: true }, ...accounts.map((a) => ({ value: a.clientId, label: a.handle || a.clientName }))]}
        />
        <CustomSelect
          className="min-w-[140px]"
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: "Last 7 days" },
            { value: "14", label: "Last 14 days" },
            { value: "30", label: "Last 30 days" },
            { value: "60", label: "Last 60 days" },
          ]}
        />
        <span className="hidden text-[10px] text-slate-600 sm:inline">Instagram only — Facebook Pages aren&apos;t connected yet</span>
        <button
          onClick={syncNow}
          disabled={syncing || accounts.length === 0}
          className="ml-auto flex items-center gap-2 rounded-lg bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
          style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
        >
          {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sync now (30 days)
        </button>
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
          <div className="text-sm font-semibold text-slate-300">No Instagram accounts linked to clients yet</div>
          <div className="mt-1 text-xs text-slate-500">
            Open <Link href="/clients" className="text-cyan-300 hover:underline">Clients</Link>, edit a client and use <strong className="text-slate-300">Find accounts</strong> next to Instagram to link one.
          </div>
        </div>
      ) : !hasData ? (
        <div className="glass-panel p-8 text-center text-xs text-slate-500">
          {accounts.length} account{accounts.length === 1 ? "" : "s"} linked, but no data stored yet. Click <strong className="text-slate-300">Sync now</strong> to pull the last 30 days.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Kpi label="Followers" icon={Users} color="text-blue-400" value={formatNumber(kpis.followers)} change={kpis.followerDelta != null ? `${kpis.followerDelta >= 0 ? "+" : ""}${formatNumber(kpis.followerDelta)}` : null} />
            <Kpi label="Reach" icon={TrendingUp} color="text-emerald-400" value={compactNumber(kpis.reach.value)} change={kpis.reach.change} />
            <Kpi label="Views" icon={Eye} color="text-violet-400" value={compactNumber(kpis.views.value)} change={kpis.views.change} />
            <Kpi label="Profile visits" icon={UserCheck} color="text-amber-400" value={compactNumber(kpis.profileViews.value)} change={kpis.profileViews.change} />
            <Kpi label="Accounts engaged" icon={MousePointerClick} color="text-rose-400" value={compactNumber(kpis.engaged.value)} change={kpis.engaged.change} />
          </div>
          <div className="-mt-2 text-[10px] text-slate-600">Changes compare against the previous {days} days. Reach is summed per day, so it counts a person once for each day they were reached.</div>

          <div className="glass-panel p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">Reach &amp; views per day</h3>
            <div className="h-[280px]">
              {mounted && (
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
              )}
            </div>
          </div>

          <div className="glass-panel overflow-x-auto p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">By account</h3>
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Account</th>
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
                  const lastFollowers = [...a.snapshots].reverse().find((s) => s.followers_count != null)?.followers_count;
                  return (
                    <tr key={a.clientId} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-100">{a.clientName}</div>
                        <div className="text-[10px] text-slate-500">{a.handle}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-200">{lastFollowers != null ? formatNumber(lastFollowers) : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{formatNumber(sum(one, win.from, win.to, "reach"))}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{formatNumber(sum(one, win.from, win.to, "views"))}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{formatNumber(sum(one, win.from, win.to, "profile_views"))}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{formatNumber(sum(one, win.from, win.to, "accounts_engaged"))}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{formatNumber(sum(one, win.from, win.to, "total_interactions"))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="glass-panel overflow-x-auto p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">Top posts</h3>
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
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">No posts in this range.</td>
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
                      <td className="px-3 py-2.5 text-slate-400">{p.media_type?.replace("_", " ").toLowerCase() ?? "—"}</td>
                      <td className="px-3 py-2.5 text-slate-400">{p.posted_at?.slice(0, 10) ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{p.like_count != null ? formatNumber(p.like_count) : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{p.comments_count != null ? formatNumber(p.comments_count) : "—"}</td>
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
