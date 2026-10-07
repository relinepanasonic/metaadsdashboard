"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Copy, Film, ImageIcon, Loader2, Pencil, Plug, Plus, RotateCcw, Send, Trash2, XCircle } from "lucide-react";
import PostComposer, { type EditablePost, type SchedOptions } from "./PostComposer";
import MakeSetup from "./MakeSetup";
import { CONTENT_LABEL, PLATFORM_LABEL, postState, type ContentType, type MediaItem, type Platform, type PostState, type TargetStatus } from "@/lib/services/scheduler";

interface Target {
  id: string;
  platform: Platform;
  handle: string | null;
  external_id: string | null;
  status: TargetStatus;
  attempts: number;
  published_at: string | null;
  published_url: string | null;
  error: string | null;
}
interface Post {
  id: string;
  clientId: string | null;
  clientName: string | null;
  caption: string;
  contentType: ContentType;
  topic?: string | null;
  media: MediaItem[];
  scheduledAt: string;
  status: string;
  createdBy: string | null;
  targets: Target[];
}
interface MakeInfo { configured: boolean; lastPoll: string | null }

type Filter = "upcoming" | "published" | "attention" | "drafts" | "all";

const STATE_STYLE: Record<PostState, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-slate-500/15 text-slate-300" },
  cancelled: { label: "Cancelled", cls: "bg-slate-500/15 text-slate-500" },
  scheduled: { label: "Scheduled", cls: "bg-cyan-500/15 text-cyan-300" },
  publishing: { label: "Publishing…", cls: "bg-amber-500/15 text-amber-300" },
  published: { label: "Published", cls: "bg-emerald-500/15 text-emerald-300" },
  partial: { label: "Partly published", cls: "bg-amber-500/15 text-amber-300" },
  failed: { label: "Failed", cls: "bg-rose-500/15 text-rose-300" },
};

const TARGET_DOT: Record<TargetStatus, string> = {
  pending: "bg-cyan-400",
  claimed: "bg-amber-400",
  published: "bg-emerald-400",
  failed: "bg-rose-400",
  cancelled: "bg-slate-600",
};

function wib(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Jakarta", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) + " WIB";
}
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

export default function Scheduler() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [options, setOptions] = useState<SchedOptions>({ clients: [] });
  const [make, setMake] = useState<MakeInfo>({ configured: false, lastPoll: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsMigration, setNeedsMigration] = useState(false);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [composer, setComposer] = useState<{ post: EditablePost | null; duplicate?: boolean } | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [busy, setBusy] = useState("");

  const loadOptions = useCallback(async () => {
    const j = await fetch("/api/scheduler/options", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) {
      setOptions({ clients: j.clients });
      setMake(j.make);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    const j = await fetch("/api/scheduler/posts", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
    if (j.ok) {
      setPosts(j.posts);
      setError("");
      setNeedsMigration(false);
    } else {
      setError(j.error || "Could not load posts");
      setNeedsMigration(Boolean(j.needsMigration));
    }
  }, []);

  const reload = useCallback(async () => {
    await Promise.all([loadPosts(), loadOptions()]);
    setLoading(false);
  }, [loadPosts, loadOptions]);

  useEffect(() => { reload(); }, [reload]);

  // While something is being posted, keep the list fresh.
  const anyActive = posts.some((p) => ["scheduled", "publishing"].includes(postState(p.status, p.targets)) && Date.parse(p.scheduledAt) < Date.now() + 5 * 60_000);
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(() => { loadPosts(); loadOptions(); }, 30_000);
    return () => clearInterval(t);
  }, [anyActive, loadPosts, loadOptions]);

  async function act(id: string, body: object, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(id);
    await fetch(`/api/scheduler/posts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await loadPosts();
    setBusy("");
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this post permanently?")) return;
    setBusy(id);
    await fetch(`/api/scheduler/posts/${id}`, { method: "DELETE" });
    await loadPosts();
    setBusy("");
  }

  const withState = useMemo(() => posts.map((p) => ({ p, state: postState(p.status, p.targets) })), [posts]);

  const counts = useMemo(() => {
    const c = { upcoming: 0, published: 0, attention: 0, drafts: 0, all: withState.length };
    for (const { state } of withState) {
      if (state === "scheduled" || state === "publishing") c.upcoming++;
      else if (state === "published") c.published++;
      else if (state === "failed" || state === "partial") c.attention++;
      else if (state === "draft") c.drafts++;
    }
    return c;
  }, [withState]);

  const visible = useMemo(() => {
    const keep = withState.filter(({ state }) =>
      filter === "all" ? true
      : filter === "upcoming" ? state === "scheduled" || state === "publishing"
      : filter === "published" ? state === "published"
      : filter === "attention" ? state === "failed" || state === "partial"
      : state === "draft");
    keep.sort((a, b) => (filter === "upcoming" ? Date.parse(a.p.scheduledAt) - Date.parse(b.p.scheduledAt) : Date.parse(b.p.scheduledAt) - Date.parse(a.p.scheduledAt)));
    return keep;
  }, [withState, filter]);

  const groups = useMemo(() => {
    const out: { day: string; items: typeof visible }[] = [];
    for (const it of visible) {
      const day = dayKey(it.p.scheduledAt);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(it);
      else out.push({ day, items: [it] });
    }
    return out;
  }, [visible]);

  const lastPollAge = make.lastPoll ? (Date.now() - Date.parse(make.lastPoll)) / 60_000 : null;
  const makeOk = lastPollAge != null && lastPollAge <= 130;

  function duplicate(p: Post) {
    setComposer({ duplicate: true, post: { id: p.id, clientId: p.clientId, caption: p.caption, contentType: p.contentType, media: p.media, scheduledAt: p.scheduledAt, status: p.status, targets: [], topic: p.topic ?? null } });
  }

  function edit(p: Post) {
    setComposer({ post: { id: p.id, clientId: p.clientId, caption: p.caption, contentType: p.contentType, media: p.media, scheduledAt: p.scheduledAt, status: p.status, targets: p.targets, topic: p.topic ?? null } });
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "upcoming", label: "Upcoming" },
    { id: "published", label: "Published" },
    { id: "attention", label: "Needs attention" },
    { id: "drafts", label: "Drafts" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="glass-panel flex flex-wrap items-center gap-3 p-3">
        <button
          onClick={() => setShowSetup((s) => !s)}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${makeOk ? "bg-emerald-500/10 text-emerald-300" : make.lastPoll ? "bg-amber-500/10 text-amber-300" : "bg-white/[0.05] text-slate-400"}`}
          title="Click to see how to connect Make.com"
        >
          <Plug size={13} />
          {makeOk ? `Make connected · checked ${ago(make.lastPoll!)}` : make.lastPoll ? `Make last checked ${ago(make.lastPoll)}` : "Make.com not connected yet"}
        </button>
        <span className="text-[11px] text-slate-500">Times are Jakarta (WIB)</span>
        <button
          onClick={() => setComposer({ post: null })}
          disabled={needsMigration}
          className="ml-auto flex items-center gap-2 rounded-lg bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-40"
          style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
        >
          <Plus size={14} /> New post
        </button>
      </div>

      {(showSetup || (!loading && !make.lastPoll && posts.length === 0 && !needsMigration)) && <MakeSetup configured={make.configured} />}

      {needsMigration && (
        <div className="glass-panel flex items-start gap-3 p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="text-xs text-amber-200">Run <b>migration 0024_scheduler.sql</b> in the Supabase SQL Editor first — it creates the scheduler tables and the media bucket. Then reload this page.</div>
        </div>
      )}
      {error && !needsMigration && <div className="glass-panel p-3 text-xs text-rose-300">{error}</div>}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold ${filter === f.id ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:bg-white/[0.04]"}`}
            style={filter === f.id ? { boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" } : undefined}
          >
            {f.label}
            <span className={`rounded-full px-1.5 text-[10px] ${f.id === "attention" && counts.attention > 0 ? "bg-rose-500/20 text-rose-300" : "bg-white/[0.06] text-slate-500"}`}>{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="glass-panel grid place-items-center p-10 text-xs text-slate-500"><Loader2 size={18} className="mb-2 animate-spin text-cyan-400" />Loading…</div>
      ) : groups.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <CalendarClock size={28} className="mx-auto mb-3 text-slate-600" />
          <div className="text-sm font-semibold text-slate-300">{filter === "upcoming" ? "Nothing scheduled" : "Nothing here"}</div>
          <div className="mt-1 text-xs text-slate-500">{filter === "upcoming" ? "Create a post and it will appear here until Make publishes it." : "Posts will show up here as they change status."}</div>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.day}>
            <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.day}</div>
            <div className="flex flex-col gap-2.5">
              {g.items.map(({ p, state }) => {
                const st = STATE_STYLE[state];
                const first = p.media[0];
                const locked = p.targets.some((t) => t.status === "published" || t.status === "claimed");
                const hasFailed = p.targets.some((t) => t.status === "failed");
                const working = busy === p.id;
                return (
                  <div key={p.id} className="glass-panel flex flex-wrap items-start gap-4 p-3.5 sm:p-4">
                    <div className="relative h-[84px] w-[60px] shrink-0 overflow-hidden rounded-lg bg-white/[0.04]" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
                      {first?.kind === "video" ? (
                        <video src={first.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      ) : first ? (
                        // eslint-disable-next-line @next/next/no-img-element -- our own storage URL
                        <img src={first.url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-slate-600"><ImageIcon size={16} /></div>
                      )}
                      {p.media.length > 1 && <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-bold text-white">{p.media.length}</span>}
                      {first?.kind === "video" && <Film size={11} className="absolute left-1 top-1 text-white drop-shadow" />}
                    </div>

                    <div className="min-w-0 flex-1 basis-[260px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                        <span className="text-[11px] text-slate-500">{CONTENT_LABEL[p.contentType]}{p.clientName ? ` · ${p.clientName}` : ""}</span>
                      </div>
                      <div className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug text-slate-100">{p.caption || <span className="text-slate-500">(no caption)</span>}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400"><Clock size={11} />{wib(p.scheduledAt)}</div>

                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {p.targets.map((t) => (
                          <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] text-slate-300" title={t.error ?? t.status}>
                            <span className={`h-1.5 w-1.5 rounded-full ${TARGET_DOT[t.status]}`} />
                            {PLATFORM_LABEL[t.platform]}{t.handle ? ` ${t.handle}` : ""}
                            {t.status === "published" && t.published_url && <a href={t.published_url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:underline">view</a>}
                          </span>
                        ))}
                      </div>
                      {p.targets.filter((t) => t.status === "failed" && t.error).map((t) => (
                        <div key={t.id} className="mt-1.5 flex items-start gap-1.5 text-[11px] text-rose-300"><XCircle size={12} className="mt-0.5 shrink-0" /><span>{PLATFORM_LABEL[t.platform]}: {t.error}</span></div>
                      ))}
                      {state === "published" && <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-300"><CheckCircle2 size={12} />Posted on every account</div>}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {working ? <Loader2 size={16} className="animate-spin text-cyan-400" /> : (
                        <>
                          {hasFailed && <button onClick={() => act(p.id, { action: "retry" })} className="flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-3 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/25"><RotateCcw size={12} />Retry</button>}
                          {(state === "scheduled" || state === "draft") && <button onClick={() => act(p.id, { action: "publish_now" }, "Post this on the next Make check, ignoring the scheduled time?")} className="flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/25"><Send size={12} />Post now</button>}
                          {!locked && state !== "cancelled" && <button onClick={() => edit(p)} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-slate-100" title="Edit"><Pencil size={14} /></button>}
                          {state === "scheduled" && <button onClick={() => act(p.id, { action: "cancel" }, "Cancel this scheduled post? It will not be published.")} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-amber-300">Cancel</button>}
                          {state === "cancelled" && <button onClick={() => act(p.id, { action: "schedule" })} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-cyan-300">Reschedule</button>}
                          <button onClick={() => duplicate(p)} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-cyan-300" title="Duplicate — post this to other accounts"><Copy size={14} /></button>
                          <button onClick={() => remove(p.id)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300" title="Delete"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {composer && (
        <PostComposer
          options={options}
          post={composer.post}
          duplicate={composer.duplicate}
          onClose={() => setComposer(null)}
          onOptionsChanged={loadOptions}
          onSaved={() => { setComposer(null); loadPosts(); }}
        />
      )}
    </div>
  );
}
