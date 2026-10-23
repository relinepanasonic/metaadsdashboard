"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Clipboard, Download, Loader2, Sparkles, Star, Trash2 } from "lucide-react";
import CustomSelect from "@/components/CustomSelect";
import { useWorkspace } from "@/components/WorkspaceProvider";
import BibleEditor from "./BibleEditor";
import { VerdictChip } from "./PostInsightsModal";
import { MODEL_OPTIONS } from "@/lib/seo/constants";
import { MISS_PAN_BIBLE } from "@/lib/reengine/missPanBible";
import { judgeReel, type PostMetrics, type ReelVerdicts } from "@/lib/social/reelBadges";
import { compactNumber } from "@/lib/format";
import type { ContentItem, SeriesBible, SourceAnalysis, SourcePost } from "@/lib/reengine/types";

interface StatPost extends Partial<PostMetrics> {
  media_id: string;
  caption: string | null;
  permalink: string | null;
  posted_at: string | null;
  like_count: number | null;
  comments_count: number | null;
  thumbnail_url: string | null;
  media_url: string | null;
}
interface StatAccount {
  accountId: string;
  clientId: string;
  platform: string;
  handle: string | null;
  posts: StatPost[];
}
interface Row {
  post: StatPost;
  account: string;
  v: ReelVerdicts;
  views: number;
}

interface Result {
  runId: string | null;
  analysis: SourceAnalysis;
  items: ContentItem[];
  provider: string;
  fellBackBecause?: string;
  warnings: string[];
}
interface RunSummary {
  id: string;
  createdAt: string;
  createdBy: string | null;
  provider: string | null;
  sourceCaption: string;
  titles: string[];
}

const inputCls = "w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none [color-scheme:dark]";
const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(t);
    return ok;
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        }
      }}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold ${done ? "bg-emerald-500/20 text-emerald-200" : "bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25"}`}
    >
      {done ? <Check size={12} /> : <Clipboard size={12} />} {done ? "Copied" : label}
    </button>
  );
}

function Cover({ post }: { post: StatPost }) {
  const src = post.thumbnail_url || post.media_url;
  return (
    <span className="grid h-[58px] w-[44px] shrink-0 place-items-center overflow-hidden rounded-lg bg-white/[0.05]">
      {/* eslint-disable-next-line @next/next/no-img-element -- remote Instagram cover */}
      {src ? <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <span className="text-[9px] text-slate-600">no cover</span>}
    </span>
  );
}

export default function ReEngine() {
  const ws = useWorkspace();
  const clientId = ws.workspaceId;
  const clientName = ws.workspace?.name ?? "this workspace";

  const [tab, setTab] = useState<"engine" | "bible">("engine");
  const [bible, setBible] = useState<SeriesBible | null | undefined>(undefined);
  const [bibleError, setBibleError] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [mode, setMode] = useState<"posts" | "paste">("posts");
  const [winnersOnly, setWinnersOnly] = useState(false);
  const [picked, setPicked] = useState<string>("");
  const [pasted, setPasted] = useState("");
  const [script, setScript] = useState("");

  const [count, setCount] = useState("3");
  const [formatHint, setFormatHint] = useState("");
  const [productKeys, setProductKeys] = useState<string[]>([]);
  const [guestKeys, setGuestKeys] = useState<string[]>([]);
  const [direction, setDirection] = useState("");
  const [model, setModel] = useState("");

  const [busy, setBusy] = useState(false);
  const [busyRow, setBusyRow] = useState(""); // media id of the Reel being re-engineered from its own button
  const [error, setError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);

  // ---- the series bible of this workspace ----
  const loadBible = useCallback(() => {
    if (!clientId) return;
    setBible(undefined);
    setBibleError("");
    fetch(`/api/reengine/bible?clientId=${clientId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.ok ? setBible(j.bible) : (setBible(null), setBibleError(j.error ?? "Could not load the bible."))))
      .catch(() => setBibleError("Network error"));
  }, [clientId]);
  useEffect(loadBible, [loadBible]);

  const [loadingTemplate, setLoadingTemplate] = useState(false);
  async function loadTemplate() {
    setLoadingTemplate(true);
    setError("");
    const next = structuredClone(MISS_PAN_BIBLE);
    const res = await fetch("/api/reengine/bible", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, bible: next }) }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
    setLoadingTemplate(false);
    if (res.ok) {
      setBible(next);
      setBibleError("");
    } else setError(res.error ?? "Could not save the template.");
  }

  // ---- this client's Reels with their Hook / Value / CTA verdicts ----
  useEffect(() => {
    if (ws.loading) return;
    setLoadingPosts(true);
    fetch("/api/social/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const accounts = (j.ok ? j.accounts : []) as StatAccount[];
        const out: Row[] = [];
        for (const a of accounts) {
          if (a.platform !== "instagram" || (clientId && a.clientId !== clientId)) continue;
          for (const p of a.posts) {
            const v = judgeReel(p as PostMetrics);
            if (v.applicable) out.push({ post: p, account: a.handle ?? "", v, views: p.views ?? 0 });
          }
        }
        out.sort((x, y) => Number(y.v.winner) - Number(x.v.winner) || y.views - x.views);
        setRows(out);
      })
      .catch(() => setRows([]))
      .finally(() => setLoadingPosts(false));
  }, [clientId, ws.loading]);

  const loadRuns = useCallback(() => {
    if (!clientId) return;
    fetch(`/api/reengine/runs?clientId=${clientId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => j.ok && setRuns(j.runs)).catch(() => {});
  }, [clientId]);
  useEffect(loadRuns, [loadRuns]);

  // changing workspace starts clean
  useEffect(() => {
    setPicked("");
    setResult(null);
    setProductKeys([]);
    setGuestKeys([]);
  }, [clientId]);

  const visible = useMemo(() => (winnersOnly ? rows.filter((r) => r.v.winner) : rows), [rows, winnersOnly]);
  const selected = rows.find((r) => r.post.media_id === picked) ?? null;

  function buildSource(row?: Row): SourcePost | null {
    if (!row && mode === "paste") return pasted.trim() ? { caption: pasted.trim(), script: script.trim() || undefined } : null;
    const chosen = row ?? selected;
    if (!chosen) return null;
    const p = chosen.post;
    return {
      mediaId: p.media_id,
      permalink: p.permalink,
      account: chosen.account,
      postedAt: p.posted_at,
      caption: p.caption ?? "",
      script: script.trim() || undefined,
      metrics: {
        views: p.views ?? null, reach: p.reach ?? null, likes: p.like_count, comments: p.comments_count, saves: p.saved ?? null, shares: p.shares ?? null,
        avgWatchSec: p.avg_watch_time_ms != null ? p.avg_watch_time_ms / 1000 : null, skipRate: p.skip_rate ?? null,
      },
      verdicts: { hook: chosen.v.hook.label, value: chosen.v.value.label, cta: chosen.v.cta.label, hookWhy: chosen.v.hook.why, valueWhy: chosen.v.value.why, ctaWhy: chosen.v.cta.why },
    };
  }

  async function generate(row?: Row) {
    const source = buildSource(row);
    if (!source) return setError(mode === "paste" ? "Paste the caption of a successful post first." : "Pick a successful post first.");
    if (row) setPicked(row.post.media_id);
    setBusy(true);
    setBusyRow(row?.post.media_id ?? "");
    setError("");
    setResult(null);
    const res = await fetch("/api/reengine/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, source, count: Number(count), direction, formatHint, productKeys, guestKeys, model: model || undefined }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error (the request may have timed out — try fewer contents)" }));
    setBusy(false);
    setBusyRow("");
    if (!res.ok) return setError(res.error ?? "Could not generate.");
    setResult(res as Result);
    loadRuns();
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }

  async function openRun(id: string) {
    setError("");
    const res = await fetch(`/api/reengine/runs/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (!res?.ok) return setError("Could not open that run.");
    setResult({ runId: id, analysis: res.run.analysis, items: res.run.items, provider: res.run.provider ?? "claude", warnings: [] });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteRun(id: string) {
    if (!window.confirm("Delete this run?")) return;
    await fetch(`/api/reengine/runs/${id}`, { method: "DELETE" });
    if (result?.runId === id) setResult(null);
    loadRuns();
  }

  const toggle = (list: string[], set: (v: string[]) => void, key: string) => set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  if (!clientId) return <div className="p-6 text-xs text-slate-500">Pick a workspace in the sidebar.</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {(["engine", "bible"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 text-xs font-semibold ${tab === t ? "bg-cyan-500/15 text-cyan-300" : "bg-white/[0.04] text-slate-400 hover:text-slate-200"}`} style={tab === t ? { boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" } : undefined}>
            {t === "engine" ? "Re-Engine" : "Series Bible"}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">Workspace: <b className="text-slate-300">{clientName}</b></span>
      </div>

      {tab === "bible" && (
        bible === undefined ? <div className="p-6 text-xs text-slate-500">Loading…</div> : (
          <>
            {bibleError && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{bibleError}</div>}
            <BibleEditor key={clientId + (bible ? "b" : "n")} clientId={clientId} clientName={clientName} initial={bible} onSaved={(b) => setBible(b)} />
          </>
        )
      )}

      {tab === "engine" && (
        <>
          {bible === null && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[11px] text-slate-400">
              <span>
                <b className="text-slate-200">Quick mode.</b> The AI copies the structure of the Reel you pick and writes new scripts, captions and Google Flow prompts. Nothing to set up. The prompts ask Flow to keep the person from your reference photo.
              </span>
              <button type="button" onClick={loadTemplate} disabled={loadingTemplate} className="ml-auto shrink-0 text-[11px] font-semibold text-slate-500 hover:text-slate-300 disabled:opacity-50" title="Optional: fixes one character, one apartment and exact product looks in every prompt">
                {loadingTemplate ? "Saving…" : "Optional: use the Miss Pan Series Bible"}
              </button>
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>
          )}

          {/* 1. source */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#0e1420]/70 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-black text-white">1. Pick the successful content</h2>
              <div className="ml-auto flex items-center gap-2 text-[11px]">
                {(["posts", "paste"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 font-semibold ${mode === m ? "bg-white/[0.1] text-white" : "text-slate-500 hover:text-slate-300"}`}>
                    {m === "posts" ? "From my Reels" : "Paste it myself"}
                  </button>
                ))}
              </div>
            </div>

            {mode === "posts" ? (
              <div className="mt-4">
                <label className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
                  <input type="checkbox" checked={winnersOnly} onChange={(e) => setWinnersOnly(e.target.checked)} className="accent-cyan-400" /> Only winners (good Hook and good Value)
                </label>
                {loadingPosts ? (
                  <div className="py-6 text-center text-xs text-slate-500">Loading Reels…</div>
                ) : visible.length === 0 ? (
                  <div className="rounded-lg bg-white/[0.03] p-4 text-xs text-slate-500">No Reels with results for {clientName}{winnersOnly ? " that count as winners" : ""} yet. Switch to “Paste it myself”, or untick the filter.</div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto rounded-xl border border-white/[0.06]">
                    {visible.slice(0, 60).map((r) => {
                      const on = r.post.media_id === picked;
                      return (
                        <div key={r.post.media_id} className={`flex w-full items-center gap-3 border-b border-white/[0.05] px-3 py-2.5 last:border-0 ${on ? "bg-cyan-500/10" : "hover:bg-white/[0.04]"}`}>
                          <button
                            type="button"
                            onClick={() => generate(r)}
                            disabled={busy}
                            title="Generate new contents from this Reel with the settings below"
                            className="flex w-[78px] shrink-0 flex-col items-center gap-1 rounded-lg bg-cyan-500/15 px-2 py-2 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-40"
                            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" }}
                          >
                            {busyRow === r.post.media_id ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                            {busyRow === r.post.media_id ? "Writing…" : "Re-engine"}
                          </button>
                          <button type="button" onClick={() => setPicked(r.post.media_id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <Cover post={r.post} />
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-[12px] font-medium leading-snug text-slate-100">{r.post.caption?.trim() || "(no caption)"}</div>
                            <div className="mt-1 text-[10px] text-slate-500">{r.account} · {r.post.posted_at?.slice(0, 10) ?? ""}</div>
                          </div>
                          {r.v.winner && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300"><Star size={10} /> Winner</span>}
                          <div className="hidden items-center gap-1.5 sm:flex"><VerdictChip v={r.v.hook} /><VerdictChip v={r.v.value} /><VerdictChip v={r.v.cta} /></div>
                          <div className="w-[56px] text-right text-[11px] tabular-nums text-slate-300">{r.views ? compactNumber(r.views) : "—"}<div className="text-[9px] text-slate-600">views</div></div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <span className={labelCls}>Caption of the successful content</span>
                <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} placeholder="Paste the caption (and hashtags) of a Reel that worked…" className={`${inputCls} resize-y`} />
              </div>
            )}

            <div className="mt-4">
              <span className={labelCls}>Original script or video prompt (optional; the AI reads the structure much better with it)</span>
              <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={4} placeholder="Paste the script / Google Flow prompt that made this video, if you have it…" className={`${inputCls} resize-y`} />
            </div>
          </section>

          {/* 2. settings */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#0e1420]/70 p-5">
            <h2 className="text-sm font-black text-white">2. What should the new contents be?</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <span className={labelCls}>How many new contents</span>
                <CustomSelect size="sm" value={count} onChange={setCount} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} content${n > 1 ? "s" : ""}` }))} />
              </div>
              <div>
                <span className={labelCls}>Format (optional)</span>
                <input value={formatHint} onChange={(e) => setFormatHint(e.target.value)} placeholder="e.g. Mitos vs Fakta, Game, Tutorial santai" className={inputCls} />
              </div>
              <div>
                <span className={labelCls}>Claude model</span>
                <CustomSelect size="sm" value={model} onChange={setModel} options={[{ value: "", label: "Sonnet 5 — balanced (default)" }, ...MODEL_OPTIONS.map((m) => ({ value: m.id, label: m.label }))]} />
              </div>
            </div>
            {bible && bible.products.length + bible.guests.length > 0 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <span className={labelCls}>Products to feature (none selected = the AI chooses and varies them)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {bible.products.filter((p) => p.usable).map((p) => (
                      <button key={p.key} type="button" onClick={() => toggle(productKeys, setProductKeys, p.key)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${productKeys.includes(p.key) ? "bg-cyan-500/20 text-cyan-200" : "bg-white/[0.05] text-slate-400 hover:text-slate-200"}`} title={p.name}>
                        {p.key.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className={labelCls}>Guest characters (none selected = the AI varies them)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {bible.guests.map((g) => (
                      <button key={g.key} type="button" onClick={() => toggle(guestKeys, setGuestKeys, g.key)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${guestKeys.includes(g.key) ? "bg-cyan-500/20 text-cyan-200" : "bg-white/[0.05] text-slate-400 hover:text-slate-200"}`} title={g.role}>
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4">
              <span className={labelCls}>Extra direction (optional)</span>
              <textarea value={direction} onChange={(e) => setDirection(e.target.value)} rows={2} placeholder="e.g. Make them funnier. Focus on the kitchen. Use a family situation." className={`${inputCls} resize-y`} />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => generate()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/20 px-5 py-2.5 text-xs font-bold text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50" style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {busy && !busyRow ? "Analysing and writing…" : "Generate from the selected / pasted content"}
              </button>
              {busy && <span className="text-[11px] text-slate-500">Takes 1 to 3 minutes. Please keep this page open.</span>}
              {error && <span className="text-[11px] text-rose-300">{error}</span>}
            </div>
          </section>
        </>
      )}

      {/* results */}
      {tab === "engine" && busy && busyRow && (
        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] px-4 py-3 text-xs text-cyan-100">
          <Loader2 size={15} className="animate-spin" /> Analysing the Reel and writing {count} new content{count === "1" ? "" : "s"}. This takes 1 to 3 minutes; please keep this page open.
        </div>
      )}
      {tab === "engine" && result && (
        <div ref={resultRef} className="flex scroll-mt-4 flex-col gap-5">
          <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.04] p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-black text-white">What made it work</h2>
              <span className="text-[11px] text-slate-500">written by {result.provider === "qwen" ? `Qwen (Claude was unavailable: ${result.fellBackBecause ?? "error"})` : "Claude"}</span>
              {result.runId && (
                <a href={`/api/reengine/export?runId=${result.runId}`} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.1]"><Download size={12} /> Download Excel</a>
              )}
            </div>
            <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
              {([["Hook formula", result.analysis.formula], ["Reusable pattern", result.analysis.pattern], ["Structure", result.analysis.structure], ["Why it worked", result.analysis.why], ["Kept", result.analysis.keep], ["Changed", result.analysis.vary]] as [string, string][]).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-white/[0.04] p-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{k}</dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-200">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>

          {result.items.map((it, i) => (
            <ItemCard key={i} n={i + 1} item={it} bible={bible ?? null} />
          ))}
        </div>
      )}

      {/* history */}
      {tab === "engine" && runs.length > 0 && (
        <section className="rounded-2xl border border-white/[0.08] bg-[#0e1420]/70 p-5">
          <h2 className="text-sm font-black text-white">Previous runs</h2>
          <div className="mt-3 divide-y divide-white/[0.05]">
            {runs.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-2.5 text-xs">
                <button type="button" onClick={() => openRun(r.id)} className="min-w-0 flex-1 text-left hover:text-cyan-200">
                  <div className="truncate font-semibold text-slate-200">{r.titles.filter(Boolean).join(" · ") || "(no titles)"}</div>
                  <div className="truncate text-[10px] text-slate-500">from “{r.sourceCaption}” · {new Date(r.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })} WIB{r.createdBy ? ` · ${r.createdBy}` : ""}</div>
                </button>
                <a href={`/api/reengine/export?runId=${r.id}`} className="text-[11px] font-semibold text-slate-400 hover:text-slate-200">Excel</a>
                <button type="button" onClick={() => deleteRun(r.id)} className="text-slate-600 hover:text-rose-300" title="Delete"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ItemCard({ n, item, bible }: { n: number; item: ContentItem; bible: SeriesBible | null }) {
  const [openImg, setOpenImg] = useState(false);
  const [openVid, setOpenVid] = useState(false);
  const products = item.productKeys.map((k) => bible?.products.find((p) => p.key === k)?.name ?? k);
  const guests = item.guestKeys.map((k) => bible?.guests.find((g) => g.key === k)?.name ?? k);
  const wordsOk = item.dialogueWords >= 95 && item.dialogueWords <= 140;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0e1420]/70 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-500/15 text-xs font-black text-cyan-300">{n}</span>
        <h3 className="text-sm font-black text-white">{item.title}</h3>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-slate-300">{item.format}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${wordsOk ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{item.dialogueWords} words of dialogue</span>
      </div>
      <div className="mt-1.5 text-[11px] text-slate-500">
        {products.length ? products.join(" + ") : item.spokenNames}{guests.length ? ` · with ${guests.join(", ")}` : " · host only"} · {item.angle}
      </div>

      {item.warnings.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <ul className="list-disc space-y-0.5 pl-4">{item.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {([["Hook", item.hook], ["Problem / Pain", item.problem], ["Solution (+RTB)", item.solution], ["CTA", item.cta]] as [string, string][]).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-white/[0.04] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{k}</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-200">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CopyButton text={item.imagePrompt} label="Copy image prompt" />
        <CopyButton text={item.videoPrompt} label="Copy video prompt (Google Flow)" />
        <CopyButton text={item.caption} label="Copy caption" />
        <button type="button" onClick={() => setOpenImg(!openImg)} className="text-[11px] font-semibold text-slate-400 hover:text-slate-200">{openImg ? "Hide" : "Show"} image prompt</button>
        <button type="button" onClick={() => setOpenVid(!openVid)} className="text-[11px] font-semibold text-slate-400 hover:text-slate-200">{openVid ? "Hide" : "Show"} video prompt</button>
      </div>

      {openImg && <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed text-slate-300">{item.imagePrompt}</pre>}
      {openVid && <pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed text-slate-300">{item.videoPrompt}</pre>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-white/[0.04] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Dialogue</div>
          <div className="mt-1 space-y-1 text-xs leading-relaxed text-slate-300">{item.dialogue.map((l, i) => <p key={i}>{l}</p>)}</div>
        </div>
        <div className="rounded-lg bg-white/[0.04] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Caption + hashtags</div>
          <div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{item.caption}</div>
        </div>
      </div>
    </section>
  );
}
