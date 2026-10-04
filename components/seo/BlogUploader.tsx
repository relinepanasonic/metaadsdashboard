"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, Inbox, Loader2, Plug, RefreshCw, Rocket, XCircle } from "lucide-react";
import { useSeoSite } from "@/components/seo/SeoSiteProvider";
import { FIRSTHAND_MARKER } from "@/lib/seo/constants";
import type { ConnectionState } from "@/lib/seo/classifyPublish";

interface SiteInfo {
  id: string;
  label: string;
  domain: string;
  publish_url: string | null;
  publish_secret: string | null;
  publish_cadence_per_week: number;
  last_auto_published_at: string | null;
}

interface Item {
  id: string;
  keyword: string;
  status: string;
  draft_title: string | null;
  draft_html: string | null;
}

interface LogRow {
  id: string;
  created_at: string;
  site_label: string | null;
  keyword: string | null;
  title: string | null;
  slug: string | null;
  event: "upload" | "received";
  status: "success" | "failed" | "received";
  trigger: "manual" | "auto" | "ai-office";
  by_user: string | null;
  url: string | null;
  http_status: number | null;
  error: string | null;
}

type Filter = "all" | "success" | "failed" | "received";

const GOOD: ConnectionState[] = ["ok", "ok-no-dryrun"];
const CADENCE = [0, 1, 2, 3, 5, 7];

function wib(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
  };
}

const STATUS_STYLE = {
  success: { label: "Uploaded", cls: "bg-emerald-500/15 text-emerald-300" },
  failed: { label: "Failed", cls: "bg-rose-500/15 text-rose-300" },
  received: { label: "Draft received", cls: "bg-violet-500/15 text-violet-300" },
} as const;

const TRIGGER_LABEL = { manual: "Manual", auto: "Auto-publish", "ai-office": "AI Office" } as const;

export default function BlogUploader() {
  const { selected, selectedSite, loading: loadingSites } = useSeoSite();
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ state: ConnectionState; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!selected) return;
    const [sites, content, log] = await Promise.all([
      fetch("/api/seo/gsc/sites", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`/api/seo/content?siteId=${selected}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`/api/seo/blog/log?siteId=${selected}${filter !== "all" ? `&status=${filter}` : ""}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    if (sites?.ok) setSite((sites.sites as SiteInfo[]).find((s) => s.id === selected) ?? null);
    if (content?.ok) setItems(content.items);
    if (log?.ok) {
      setRows(log.rows);
      setNeedsMigration(Boolean(log.needsMigration));
    }
    setLoading(false);
  }, [selected, filter]);

  useEffect(() => {
    setLoading(true);
    setTest(null);
    load();
  }, [load]);

  const needsExperience = (i: Item) => Boolean(i.draft_html?.includes(FIRSTHAND_MARKER));
  const queue = useMemo(() => items.filter((i) => i.status === "approved"), [items]);
  const drafts = useMemo(() => items.filter((i) => i.status === "drafted"), [items]);
  const lastUpload = rows.find((r) => r.event === "upload");

  async function upload(i: Item) {
    if (!window.confirm(`Upload "${i.draft_title || i.keyword}" to ${site?.domain ?? "the website"} now? It goes live immediately.`)) return;
    setBusyId(i.id);
    setMsg(null);
    const res = await fetch("/api/seo/content/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: i.id }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
    setBusyId("");
    setMsg({ id: i.id, ok: Boolean(res.ok), text: res.ok ? `Live: ${res.url}` : res.error || "Upload failed" });
    load();
  }

  async function setCadence(n: number) {
    if (!site) return;
    setSite({ ...site, publish_cadence_per_week: n });
    await fetch(`/api/seo/gsc/sites/${site.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publish_cadence_per_week: n }) });
  }

  async function runTest() {
    if (!site) return;
    setTesting(true);
    setTest(null);
    const res = await fetch("/api/seo/website/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId: site.id }) }).then((r) => r.json()).catch(() => null);
    setTesting(false);
    setTest(res?.ok ? { state: res.state, message: res.message } : { state: "unknown", message: res?.error || "Test failed." });
  }

  if (loadingSites || (loading && !site)) return <div className="glass-panel grid place-items-center p-10 text-xs text-slate-500"><Loader2 size={18} className="mb-2 animate-spin text-cyan-400" />Loading…</div>;
  if (!selected || !selectedSite) return <div className="glass-panel p-8 text-center text-xs text-slate-500">Pick a website at the top of the page.</div>;

  const configured = Boolean(site?.publish_url && site?.publish_secret);
  const doorOk = test ? GOOD.includes(test.state) : null;
  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "Everything" },
    { id: "success", label: "Uploaded" },
    { id: "failed", label: "Failed" },
    { id: "received", label: "Drafts received" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* The door */}
      <div className="glass-panel p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "rgba(34,211,238,0.1)", boxShadow: "0 0 0 1px rgba(34,211,238,0.3)" }}><Plug size={18} className="text-cyan-300" /></span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">Door to {selectedSite.label}</div>
            <div className="truncate text-[11px] text-slate-500">
              {configured ? `Uploads go to ${(() => { try { return new URL(site!.publish_url!).host; } catch { return site!.publish_url; } })()}` : "No publish endpoint set yet"}
            </div>
          </div>
          <span className={`ml-auto rounded-full px-3 py-1 text-[11px] font-bold ${doorOk === true ? "bg-emerald-500/15 text-emerald-300" : doorOk === false ? "bg-rose-500/15 text-rose-300" : configured ? "bg-amber-500/15 text-amber-300" : "bg-white/[0.06] text-slate-400"}`}>
            {doorOk === true ? "Open" : doorOk === false ? "Not working" : configured ? "Not tested" : "Not set up"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={runTest} disabled={testing || !configured} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-40" style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" }}>
            {testing ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />} Test the door
          </button>
          <Link href="/seo/blog/connection" className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-white/[0.05] hover:text-slate-200">{configured ? "Edit connection" : "Set up the connection"} →</Link>

          <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            <CalendarClock size={14} className={site && site.publish_cadence_per_week > 0 ? "text-emerald-400" : "text-slate-500"} />
            Auto-upload
            <select
              value={site?.publish_cadence_per_week ?? 0}
              onChange={(e) => setCadence(Number(e.target.value))}
              className="rounded-lg border border-white/[0.12] bg-[#0b0e14] px-2 py-1.5 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none"
            >
              {CADENCE.map((n) => <option key={n} value={n}>{n === 0 ? "Off" : `${n} per week`}</option>)}
            </select>
          </div>
        </div>

        {test && (
          <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-xs ${doorOk ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200"}`}>
            {doorOk ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <XCircle size={15} className="mt-0.5 shrink-0" />}
            <span>{test.message}</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { l: "Ready to upload", v: queue.length, hint: "approved, waiting for the next slot" },
            { l: "Drafts", v: drafts.length, hint: `${drafts.filter(needsExperience).length} still need your experience` },
            { l: "Last upload", v: lastUpload ? wib(lastUpload.created_at).day : "—", hint: lastUpload ? (lastUpload.status === "success" ? "worked" : "failed") : "" },
            { l: "Last auto-upload", v: site?.last_auto_published_at ? wib(site.last_auto_published_at).day : "—", hint: "" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl bg-white/[0.04] p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{s.l}</div>
              <div className="mt-1 text-lg font-black text-slate-100">{s.v}</div>
              {s.hint && <div className="text-[10px] text-slate-600">{s.hint}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Ready to upload */}
      <div className="glass-panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-100">Ready to upload</div>
          <Link href="/seo/blog/content" className="text-[11px] font-semibold text-cyan-300 hover:underline">Write or edit posts in Content Engine →</Link>
        </div>
        {queue.length + drafts.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-xs text-slate-500"><Inbox size={16} /> Nothing waiting. Drafts from the Content Engine or the AI Office appear here.</div>
        ) : (
          <div className="flex flex-col divide-y divide-white/[0.05] rounded-lg bg-white/[0.03]">
            {[...queue, ...drafts].map((i) => {
              const locked = needsExperience(i);
              return (
                <div key={i.id} className="px-3 py-2.5 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-100">{i.draft_title || i.keyword}</div>
                      <div className="truncate text-[10px] text-slate-500">{i.keyword}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${i.status === "approved" ? "bg-cyan-500/15 text-cyan-300" : "bg-white/[0.07] text-slate-400"}`}>{i.status === "approved" ? "Approved" : "Draft"}</span>
                    {locked && <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300" title="Fill in “Dari Pengalaman Kami” in the Content Engine first">Needs your experience</span>}
                    <button
                      onClick={() => upload(i)}
                      disabled={locked || !configured || busyId !== ""}
                      title={locked ? "Fill in the experience section first" : !configured ? "Set up the connection first" : "Upload now"}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40"
                    >
                      {busyId === i.id ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />} Upload now
                    </button>
                  </div>
                  {msg?.id === i.id && <div className={`mt-1.5 text-[11px] ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>{msg.text}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log */}
      <div className="glass-panel p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="mr-2 text-sm font-semibold text-slate-100">Upload log</div>
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${filter === f.id ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:bg-white/[0.05]"}`} style={filter === f.id ? { boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" } : undefined}>{f.label}</button>
          ))}
          <button onClick={() => { setLoading(true); load(); }} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:bg-white/[0.05]"><RefreshCw size={12} /> Refresh</button>
        </div>

        {needsMigration ? (
          <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 p-4 text-xs text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
            <span>Run <b>migration 0027_blog_upload_log.sql</b> in the Supabase SQL Editor to start recording uploads. Everything else works without it.</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">No uploads recorded yet. Each upload to the website, and each draft from the AI Office, will be listed here with its time.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Time (WIB)</th>
                  <th className="px-3 py-2.5 font-semibold">Post</th>
                  <th className="px-3 py-2.5 font-semibold">Result</th>
                  <th className="px-3 py-2.5 font-semibold">Started by</th>
                  <th className="px-3 py-2.5 font-semibold">Live page</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const t = wib(r.created_at);
                  const st = STATUS_STYLE[r.status];
                  return (
                    <tr key={r.id} className="border-t border-white/[0.05] align-top hover:bg-white/[0.02]">
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="font-medium text-slate-200">{t.time}</div>
                        <div className="text-[10px] text-slate-500">{t.day}</div>
                      </td>
                      <td className="max-w-[340px] px-3 py-2.5">
                        <div className="truncate font-medium text-slate-100" title={r.title ?? r.keyword ?? ""}>{r.title || r.keyword || "—"}</div>
                        {r.slug && <div className="truncate font-mono text-[10px] text-slate-600">/{r.slug}/</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                        {r.error && <div className="mt-1 max-w-[320px] text-[11px] leading-snug text-rose-300">{r.error}{r.http_status ? ` (HTTP ${r.http_status})` : ""}</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">{TRIGGER_LABEL[r.trigger]}{r.by_user ? ` · ${r.by_user}` : ""}</td>
                      <td className="px-3 py-2.5">
                        {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:underline">Open <ExternalLink size={11} /></a> : <span className="text-slate-700">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
