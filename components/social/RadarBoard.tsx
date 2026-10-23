"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, ChevronDown, ChevronRight, ExternalLink, Eye, Loader2, Plus, RefreshCw, Sparkles, Trash2, Trophy } from "lucide-react";
import CustomSelect from "@/components/CustomSelect";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { VerdictChip } from "./PostInsightsModal";
import { compactNumber } from "@/lib/format";
import { judgeReel, type PostMetrics } from "@/lib/social/reelBadges";
import type { Decoded } from "@/lib/radar/decode";

interface Acct {
  id: string;
  clientId: string;
  handle: string | null;
  niche: string;
  auto: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  watching: number;
}
interface Watch {
  id: string;
  handle: string;
  note: string | null;
  followers: number | null;
  last_collected_at: string | null;
  last_error: string | null;
}
interface RadarReel {
  id: string;
  handle: string;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  followers: number | null;
  outlier: number | null;
  score_basis: string | null;
  decode: Decoded | null;
  decode_mode: string | null;
  decode_error: string | null;
  hasVideo: boolean;
}
interface Variant {
  label: string;
  hook: string;
  mediaId?: string | null;
}
interface TestRow {
  id: string;
  title: string;
  notes: string | null;
  variants: Variant[];
  created_at: string;
}
interface OwnPost extends Partial<PostMetrics> {
  media_id: string;
  caption: string | null;
  posted_at: string | null;
  like_count: number | null;
  comments_count: number | null;
}

const inputCls = "w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none [color-scheme:dark]";
const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500";

function ago(iso: string | null): string {
  if (!iso) return "";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-white/[0.15]"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function OutlierChip({ r }: { r: RadarReel }) {
  const o = r.outlier ?? 0;
  const hot = o >= 3;
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-black ${hot ? "bg-amber-500/20 text-amber-300" : o >= 2 ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-slate-300"}`} title={r.score_basis === "views" ? "Views compared with this account's usual Reel" : "Engagement compared with this account's usual Reel (no view counts available)"}>
      {o.toFixed(1)}× {r.score_basis === "views" ? "usual views" : "usual engagement"}
    </span>
  );
}

function Step({ n, label, value, on }: { n: number; label: string; value: string; on: boolean }) {
  return (
    <div className={`flex min-w-[120px] flex-1 items-center gap-2 rounded-lg px-3 py-2 ${on ? "bg-cyan-500/10" : "bg-white/[0.03]"}`} style={on ? { boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.3)" } : undefined}>
      <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${on ? "bg-cyan-400 text-black" : "bg-white/[0.1] text-slate-400"}`}>{n}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-slate-200">{label}</div>
        <div className="truncate text-[10px] text-slate-500">{value}</div>
      </div>
    </div>
  );
}

export default function RadarBoard() {
  const ws = useWorkspace();
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [gemini, setGemini] = useState(false);
  const [fatal, setFatal] = useState("");
  const [accountId, setAccountId] = useState("");

  const [watch, setWatch] = useState<Watch[]>([]);
  const [reels, setReels] = useState<RadarReel[]>([]);
  const [brief, setBrief] = useState<{ summary: string; created_at: string; provider: string | null } | null>(null);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [ownPosts, setOwnPosts] = useState<OwnPost[]>([]);
  const [loading, setLoading] = useState(false);

  const [niche, setNiche] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [newNote, setNewNote] = useState("");
  const [minOutlier, setMinOutlier] = useState("1.5");
  const [shown, setShown] = useState(20);
  const [open, setOpen] = useState<string>("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ---- own Instagram accounts of the current workspace ----
  const loadAccounts = useCallback(() => {
    fetch("/api/radar/accounts", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setFatal(j.error ?? "Could not load.");
        setAccounts(j.accounts);
        setGemini(Boolean(j.gemini));
      })
      .catch(() => setFatal("Network error"));
  }, []);
  useEffect(loadAccounts, [loadAccounts]);

  const mine = useMemo(() => accounts.filter((a) => !ws.workspaceId || a.clientId === ws.workspaceId), [accounts, ws.workspaceId]);
  useEffect(() => {
    if (!mine.some((a) => a.id === accountId)) setAccountId(mine[0]?.id ?? "");
  }, [mine, accountId]);
  const account = mine.find((a) => a.id === accountId) ?? null;
  useEffect(() => setNiche(account?.niche ?? ""), [account?.id, account?.niche]);

  // ---- everything about the selected account ----
  const loadData = useCallback(() => {
    if (!accountId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/radar?accountId=${accountId}`, { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/social/stats", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ])
      .then(([j, stats]) => {
        if (j.ok) {
          setWatch(j.watch);
          setReels(j.reels);
          setBrief(j.brief);
          setTests(j.tests);
        }
        const a = (stats?.accounts ?? []).find((x: { accountId: string; platform: string }) => x.accountId === accountId && x.platform === "instagram");
        setOwnPosts(a?.posts ?? []);
      })
      .finally(() => setLoading(false));
  }, [accountId]);
  useEffect(loadData, [loadData]);

  async function call(url: string, body: unknown, key: string, method = "POST") {
    setBusy(key);
    setMsg(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: method === "DELETE" ? undefined : JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error (a long request may have timed out; try again)" }));
    setBusy("");
    return res;
  }

  async function saveConfig(patch: { niche?: string; auto?: boolean }) {
    if (!account) return;
    const res = await call("/api/radar/config", { accountId: account.id, ...patch }, "config", "PUT");
    if (!res.ok) setMsg({ ok: false, text: res.error });
    else {
      if (patch.niche !== undefined) setMsg({ ok: true, text: "Niche saved." });
      loadAccounts();
    }
  }

  async function addWatch() {
    if (!account) return;
    const res = await call("/api/radar/watch", { accountId: account.id, handle: newHandle, note: newNote }, "add");
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    setNewHandle("");
    setNewNote("");
    loadData();
    loadAccounts();
  }

  async function removeWatch(w: Watch) {
    if (!window.confirm(`Stop watching @${w.handle}? Its collected Reels are removed too.`)) return;
    await call(`/api/radar/watch?id=${w.id}`, null, "rm", "DELETE");
    loadData();
    loadAccounts();
  }

  async function collect() {
    if (!account) return;
    const res = await call("/api/radar/collect", { accountId: account.id }, "collect");
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    const results = res.results as { handle: string; reels: number; error?: string }[];
    const bad = results.filter((r) => r.error);
    setMsg({ ok: bad.length === 0, text: `Collected ${results.reduce((n, r) => n + r.reels, 0)} Reels from ${results.length - bad.length} account(s).${bad.length ? ` Problems: ${bad.map((b) => `@${b.handle} — ${b.error}`).join(" · ")}` : ""}` });
    loadData();
  }

  async function decode(r: RadarReel) {
    const res = await call("/api/radar/decode", { reelId: r.id }, "decode:" + r.id);
    if (!res.ok) setMsg({ ok: false, text: `Could not decode: ${res.error}` });
    else setOpen(r.id);
    loadData();
  }

  async function runAgent() {
    if (!account) return;
    const res = await call("/api/radar/agent", { accountId: account.id }, "agent");
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    const r = res.report;
    setMsg({ ok: !r?.errors?.length, text: r ? `Agent finished: collected ${r.collected} Reels, decoded ${r.decoded}, brief ${r.brief ? "written" : "not written (needs decoded winners)"}.${r.errors?.length ? ` Problems: ${r.errors.slice(0, 3).join(" · ")}` : ""}` : "Nothing to do." });
    loadData();
    loadAccounts();
  }

  const min = Number(minOutlier);
  const list = useMemo(() => reels.filter((r) => (r.outlier ?? 0) >= min), [reels, min]);
  const decodedCount = reels.filter((r) => r.decode).length;

  if (fatal) return <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">{fatal}</div>;
  if (!ws.workspaceId && !ws.isClient && ws.loading) return <div className="p-6 text-xs text-slate-500">Loading…</div>;
  if (mine.length === 0) return <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 text-xs text-slate-400">No Instagram account is linked to this workspace. Link one on the Clients page first.</div>;

  return (
    <div className="flex flex-col gap-5">
      {/* account + agent */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#0e1420]/70 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px]">
            <span className={labelCls}>Our Instagram account</span>
            <CustomSelect size="sm" value={accountId} onChange={setAccountId} options={mine.map((a) => ({ value: a.id, label: `${a.handle ?? a.id}${a.watching ? ` · watching ${a.watching}` : ""}` }))} />
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`rounded-full px-2.5 py-1 font-semibold ${gemini ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`} title={gemini ? "Gemini watches the video itself" : "Add GEMINI_API_KEY in Vercel to let the AI watch the videos. Until then it reads the cover image and caption."}>
              {gemini ? "Deep decode: video" : "Lite decode: cover + caption"}
            </span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Bot size={14} className="text-cyan-300" /> Weekly agent <Toggle on={Boolean(account?.auto)} onChange={(v) => saveConfig({ auto: v })} />
            </div>
            <button type="button" onClick={runAgent} disabled={busy !== "" || watch.length === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-40" style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" }}>
              {busy === "agent" ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />} {busy === "agent" ? "Agent working (1–4 min)…" : "Run the agent now"}
            </button>
          </div>
        </div>
        {account?.lastRunAt && <p className="mt-2 text-[11px] text-slate-500">Last agent run {ago(account.lastRunAt)}: {account.lastStatus}</p>}
        <div className="mt-4">
          <span className={labelCls}>This account&apos;s niche (guides the weekly brief and the decode)</span>
          <div className="flex gap-2">
            <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. AC dan elektronik rumah tangga untuk keluarga Indonesia, gaya komedi keluarga" className={inputCls} />
            <button type="button" onClick={() => saveConfig({ niche })} disabled={busy !== "" || niche === (account?.niche ?? "")} className="shrink-0 rounded-lg bg-white/[0.08] px-4 text-xs font-semibold text-slate-200 hover:bg-white/[0.12] disabled:opacity-40">Save</button>
          </div>
        </div>
      </section>

      {msg && <div className={`rounded-lg px-3 py-2 text-xs ${msg.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>{msg.text}</div>}

      {/* the five steps */}
      <div className="flex flex-wrap gap-2">
        <Step n={1} label="Collect" value={`${watch.length} account${watch.length === 1 ? "" : "s"} watched`} on={watch.length > 0} />
        <Step n={2} label="Rank" value={`${reels.length} Reels scored`} on={reels.length > 0} />
        <Step n={3} label="Decode" value={`${decodedCount} decoded`} on={decodedCount > 0} />
        <Step n={4} label="Remix" value="Re-engine button" on={decodedCount > 0} />
        <Step n={5} label="Test" value={`${tests.length} hook test${tests.length === 1 ? "" : "s"}`} on={tests.length > 0} />
      </div>

      {/* 1. watchlist */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#0e1420]/70 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-black text-white">1. Niche accounts to watch for {account?.handle}</h2>
          <span className="text-[11px] text-slate-500">Public Business or Creator accounts only (Instagram cannot read private or personal ones).</span>
          <button type="button" onClick={collect} disabled={busy !== "" || watch.length === 0} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/[0.12] disabled:opacity-40">
            {busy === "collect" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {busy === "collect" ? "Collecting…" : "Collect & rank now"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={newHandle} onChange={(e) => setNewHandle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newHandle.trim() && addWatch()} placeholder="@username or instagram.com/username" className={`${inputCls} max-w-[300px]`} />
          <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Note (optional)" className={`${inputCls} max-w-[240px]`} />
          <button type="button" onClick={addWatch} disabled={!newHandle.trim() || busy !== ""} className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40"><Plus size={13} /> Add</button>
        </div>
        {watch.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">Nothing watched yet. Add 10 to 20 accounts that do well in this account&apos;s niche (competitors, creators, brands).</p>
        ) : (
          <div className="mt-3 divide-y divide-white/[0.05] rounded-xl border border-white/[0.06]">
            {watch.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs">
                <span className="font-semibold text-slate-100">@{w.handle}</span>
                {w.followers != null && <span className="text-[11px] text-slate-500">{compactNumber(w.followers)} followers</span>}
                {w.note && <span className="text-[11px] text-slate-500">· {w.note}</span>}
                <span className={`ml-auto text-[11px] ${w.last_error ? "text-rose-300" : "text-slate-600"}`}>{w.last_error ? w.last_error : w.last_collected_at ? `collected ${ago(w.last_collected_at)}` : "not collected yet"}</span>
                <button type="button" onClick={() => removeWatch(w)} className="text-slate-600 hover:text-rose-300" title="Stop watching"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* weekly brief */}
      {brief && (
        <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.04] p-5">
          <div className="flex items-center gap-2">
            <Bot size={15} className="text-cyan-300" />
            <h2 className="text-sm font-black text-white">This week&apos;s brief</h2>
            <span className="text-[11px] text-slate-500">{ago(brief.created_at)}{brief.provider === "qwen" ? " · written by Qwen" : ""}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-200">{brief.summary}</p>
        </section>
      )}

      {/* 2-4. ranked reels */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#0e1420]/70 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-black text-white">2–4. The winners: rank, decode, remix</h2>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-400">
            Beat their usual by
            <div className="w-[110px]"><CustomSelect size="sm" value={minOutlier} onChange={setMinOutlier} options={[{ value: "1", label: "any" }, { value: "1.5", label: "1.5×+" }, { value: "2", label: "2×+" }, { value: "3", label: "3×+" }, { value: "5", label: "5×+" }]} /></div>
          </div>
        </div>
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading…</div>
        ) : list.length === 0 ? (
          <div className="mt-3 rounded-lg bg-white/[0.03] p-4 text-xs text-slate-500">{reels.length === 0 ? "No Reels collected yet. Add accounts above, then press “Collect & rank now”." : "No Reel beats its account's usual by that much. Lower the filter."}</div>
        ) : (
          <div className="mt-3 divide-y divide-white/[0.05] rounded-xl border border-white/[0.06]">
            {list.slice(0, shown).map((r) => {
              const isOpen = open === r.id;
              return (
                <div key={r.id}>
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <span className="grid h-[62px] w-[46px] shrink-0 place-items-center overflow-hidden rounded-lg bg-white/[0.05]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- remote Instagram cover */}
                      {r.thumbnail_url ? <img src={r.thumbnail_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <span className="text-[9px] text-slate-600">no cover</span>}
                    </span>
                    <div className="min-w-[200px] flex-1">
                      <div className="line-clamp-2 text-[12px] font-medium leading-snug text-slate-100">{r.caption?.trim() || "(no caption)"}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                        @{r.handle} · {ago(r.posted_at)}
                        {r.permalink && <a href={r.permalink} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-cyan-300" title="Open on Instagram"><ExternalLink size={10} /></a>}
                        {r.decode && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-300">decoded · {r.decode_mode}</span>}
                      </div>
                    </div>
                    <OutlierChip r={r} />
                    <div className="w-[64px] text-right text-[11px] tabular-nums text-slate-300">{r.views != null ? compactNumber(r.views) : "—"}<div className="text-[9px] text-slate-600">views</div></div>
                    <div className="flex items-center gap-1.5">
                      {r.decode ? (
                        <button type="button" onClick={() => setOpen(isOpen ? "" : r.id)} className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.1]">
                          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Decode
                        </button>
                      ) : (
                        <button type="button" onClick={() => decode(r)} disabled={busy !== ""} className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.1] disabled:opacity-40">
                          {busy === "decode:" + r.id ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} {busy === "decode:" + r.id ? "Decoding…" : "Decode"}
                        </button>
                      )}
                      <Link href={`/social-media/reengine?radarReel=${r.id}`} className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/20 px-3 py-1.5 text-[11px] font-bold text-cyan-100 hover:bg-cyan-500/30" title="Remix this structure into new scripts and Google Flow prompts">
                        <Sparkles size={12} /> Re-engine
                      </Link>
                    </div>
                  </div>
                  {r.decode_error && !isOpen && <div className="px-3 pb-2 text-[11px] text-amber-300">{r.decode_error}</div>}
                  {isOpen && r.decode && <DecodeCard d={r.decode} note={r.decode_error} />}
                </div>
              );
            })}
          </div>
        )}
        {list.length > shown && (
          <button type="button" onClick={() => setShown(shown + 20)} className="mt-3 text-[11px] font-semibold text-cyan-300 hover:underline">Show more ({list.length - shown} left)</button>
        )}
      </section>

      {/* 5. test */}
      <TestSection accountId={accountId} niche={account?.niche ?? ""} tests={tests} ownPosts={ownPosts} onChanged={loadData} setMsg={setMsg} />
    </div>
  );
}

function DecodeCard({ d, note }: { d: Decoded; note: string | null }) {
  const rows: [string, string][] = [
    ["Hook formula", d.hookType], ["First 3 seconds", d.firstThreeSeconds], ["Structure", d.structure], ["Spoken words", d.transcript],
    ["On-screen text", d.onScreenText], ["CTA", d.cta], ["Pacing", d.pacing], ["Audio", d.audio], ["Why it worked", d.why], ["Reusable pattern", d.pattern], ["Keep", d.keep], ["Change", d.vary],
  ];
  return (
    <div className="border-t border-white/[0.05] bg-black/20 px-4 py-4">
      <div className="mb-2 text-[10px] text-slate-500">
        {d.mode === "deep" ? "The AI watched the video." : d.mode === "lite" ? "The AI read the cover image and caption (no video), so spoken words are not available." : "The AI read the caption only."}
        {note ? ` ${note}` : ""}
      </div>
      <dl className="grid gap-2.5 sm:grid-cols-2">
        {rows.filter(([, v]) => v && !/^tidak tersedia/i.test(v)).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-white/[0.04] p-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{k}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-200">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TestSection({ accountId, niche, tests, ownPosts, onChanged, setMsg }: { accountId: string; niche: string; tests: TestRow[]; ownPosts: OwnPost[]; onChanged: () => void; setMsg: (m: { ok: boolean; text: string } | null) => void }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [hooks, setHooks] = useState<string[]>(["", "", ""]);
  const [busy, setBusy] = useState("");

  const reelsOnly = ownPosts.filter((p) => judgeReel(p as PostMetrics).applicable);
  const options = [{ value: "", label: "Not posted yet" }, ...reelsOnly.map((p) => ({ value: p.media_id, label: `${p.posted_at?.slice(0, 10) ?? ""} · ${(p.caption ?? "").replace(/\s+/g, " ").slice(0, 50)}` }))];

  async function suggest() {
    setBusy("suggest");
    setMsg(null);
    const res = await fetch("/api/radar/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "suggest", topic, niche }) }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
    setBusy("");
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    setHooks([...(res.hooks as string[]), "", "", ""].slice(0, Math.max(3, res.hooks.length)));
  }

  async function create() {
    setBusy("create");
    setMsg(null);
    const res = await fetch("/api/radar/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", accountId, title, variants: hooks.map((h, i) => ({ label: String.fromCharCode(65 + i), hook: h })) }) }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
    setBusy("");
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    setTitle("");
    setTopic("");
    setHooks(["", "", ""]);
    onChanged();
  }

  async function link(t: TestRow, idx: number, mediaId: string) {
    const variants = t.variants.map((v, i) => (i === idx ? { ...v, mediaId: mediaId || null } : v));
    await fetch("/api/radar/tests", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, variants }) });
    onChanged();
  }

  async function remove(t: TestRow) {
    if (!window.confirm("Delete this test?")) return;
    await fetch(`/api/radar/tests?id=${t.id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0e1420]/70 p-5">
      <h2 className="text-sm font-black text-white">5. Test: which hook wins?</h2>
      <p className="mt-1 text-[11px] text-slate-500">Post the same content with different opening lines. Link each posted Reel to its hook, and the page compares how many viewers left in the first 3 seconds and how long they watched.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div><span className={labelCls}>Test title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Outdoor AC berkarat" className={inputCls} /></div>
        <div>
          <span className={labelCls}>What the content is about</span>
          <div className="flex gap-2">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. outdoor AC cepat berkarat" className={inputCls} />
            <button type="button" onClick={suggest} disabled={!topic.trim() || busy !== ""} className="shrink-0 rounded-lg bg-cyan-500/15 px-3 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40">{busy === "suggest" ? "Writing…" : "Suggest 3 hooks"}</button>
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {hooks.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.08] text-[11px] font-black text-slate-300">{String.fromCharCode(65 + i)}</span>
            <input value={h} onChange={(e) => setHooks(hooks.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Hook ${String.fromCharCode(65 + i)}`} className={inputCls} />
          </div>
        ))}
        {hooks.length < 4 && <button type="button" onClick={() => setHooks([...hooks, ""])} className="inline-flex items-center gap-1 self-start text-[11px] font-semibold text-cyan-300 hover:underline"><Plus size={12} /> Add a variant</button>}
      </div>
      <button type="button" onClick={create} disabled={busy !== "" || !title.trim() || hooks.filter((h) => h.trim()).length < 2} className="mt-3 rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40">Save test</button>

      {tests.map((t) => <TestCard key={t.id} t={t} ownPosts={ownPosts} options={options} onLink={link} onDelete={remove} />)}
    </section>
  );
}

function TestCard({ t, ownPosts, options, onLink, onDelete }: { t: TestRow; ownPosts: OwnPost[]; options: { value: string; label: string }[]; onLink: (t: TestRow, idx: number, mediaId: string) => void; onDelete: (t: TestRow) => void }) {
  const stats = t.variants.map((v) => {
    const p = v.mediaId ? ownPosts.find((x) => x.media_id === v.mediaId) : undefined;
    return { v, p, verdict: p ? judgeReel(p as PostMetrics) : null };
  });
  // the winner: the lowest share of viewers leaving within 3 seconds, among variants that have a reading
  const measured = stats.filter((s) => s.p?.skip_rate != null);
  const best = measured.length >= 2 ? measured.reduce((a, b) => ((a.p!.skip_rate as number) <= (b.p!.skip_rate as number) ? a : b)) : null;

  return (
    <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-black text-white">{t.title}</h3>
        {best && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300"><Trophy size={10} /> Hook {best.v.label} is winning</span>}
        <button type="button" onClick={() => onDelete(t)} className="ml-auto text-slate-600 hover:text-rose-300" title="Delete"><Trash2 size={13} /></button>
      </div>
      <div className="mt-3 grid gap-2.5">
        {stats.map((s, i) => (
          <div key={i} className={`flex flex-wrap items-center gap-3 rounded-lg p-2.5 ${best?.v.label === s.v.label ? "bg-amber-500/[0.08]" : "bg-white/[0.03]"}`}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.1] text-[11px] font-black text-slate-200">{s.v.label}</span>
            <div className="min-w-[200px] flex-1 text-[12px] text-slate-100">{s.v.hook}</div>
            <div className="w-[260px]"><CustomSelect size="sm" value={s.v.mediaId ?? ""} onChange={(v) => onLink(t, i, v)} options={options} /></div>
            {s.p ? (
              <div className="flex items-center gap-3 text-[11px] text-slate-300">
                {s.verdict && <VerdictChip v={s.verdict.hook} />}
                <span title="Share of viewers who left within 3 seconds">{s.p.skip_rate != null ? `${s.p.skip_rate.toFixed(0)}% left in 3s` : "no skip data yet"}</span>
                <span>{s.p.avg_watch_time_ms != null ? `${(s.p.avg_watch_time_ms / 1000).toFixed(1)}s avg watch` : ""}</span>
                <span>{s.p.views != null ? `${compactNumber(s.p.views)} views` : ""}</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-600">link the Reel that used this hook</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
