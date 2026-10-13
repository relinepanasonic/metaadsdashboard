"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Loader2, Play, Eye, XCircle } from "lucide-react";
import CustomSelect from "@/components/CustomSelect";
import { MODEL_OPTIONS } from "@/lib/seo/constants";
import { useSeoSite } from "./SeoSiteProvider";

interface Setting {
  key: string;
  kind: "blog" | "threads";
  enabled: boolean;
  time_wib: string;
  topic: string | null;
  samples: string | null;
  instructions: string | null;
  model: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_message: string | null;
}

interface Data {
  settings: Setting[];
  threadsAccounts: { clientId: string; handle: string; connected: boolean }[];
  topics: { clientId: string; name: string }[];
  unusedKeywords: Record<string, number>;
  ai: { claude: boolean; qwen: boolean };
}

const inputCls = "w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none [color-scheme:dark]";
const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-white/[0.15]"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function LastRun({ s }: { s: Setting | undefined }) {
  if (!s?.last_run_at) return <p className="text-[11px] text-slate-600">Has not run yet.</p>;
  const ok = s.last_status === "ok";
  return (
    <p className={`flex items-start gap-1.5 text-[11px] ${ok ? "text-emerald-300" : "text-rose-300"}`}>
      {ok ? <CheckCircle2 size={13} className="mt-px shrink-0" /> : <XCircle size={13} className="mt-px shrink-0" />}
      <span>
        {new Date(s.last_run_at).toLocaleString("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })} WIB — {s.last_message}
      </span>
    </p>
  );
}

export default function Autopilot() {
  const { sitesForSelectedBrand, selected, setSelected, selectedBrand, brands } = useSeoSite();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/autopilot", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.ok ? (setData(j), setError("")) : setError(j.error ?? "Could not load.")))
      .catch(() => setError("Network error"));
  }, []);
  useEffect(load, [load]);

  const brandName = brands.find((b) => b.id === selectedBrand)?.name ?? "this workspace";
  const site = sitesForSelectedBrand.find((s) => s.id === selected) ?? sitesForSelectedBrand[0] ?? null;
  const accounts = useMemo(() => (data?.threadsAccounts ?? []).filter((a) => a.clientId === selectedBrand), [data, selectedBrand]);
  const topics = useMemo(() => (data?.topics ?? []).filter((t) => t.clientId === selectedBrand), [data, selectedBrand]);

  // ---- blog form ----
  const blogSaved = data?.settings.find((s) => s.key === `blog:${site?.id}`);
  const [blogOn, setBlogOn] = useState(false);
  const [blogModel, setBlogModel] = useState("");
  useEffect(() => {
    setBlogOn(Boolean(blogSaved?.enabled));
    setBlogModel(blogSaved?.model ?? "");
  }, [blogSaved?.key, blogSaved?.enabled, blogSaved?.model]);

  // ---- Threads form ----
  const [handle, setHandle] = useState("");
  useEffect(() => {
    if (!accounts.some((a) => a.handle === handle)) setHandle(accounts[0]?.handle ?? "");
  }, [accounts, handle]);
  const thSaved = data?.settings.find((s) => s.key === `threads:${selectedBrand}:${handle}`);
  const [thOn, setThOn] = useState(false);
  const [time, setTime] = useState("18:00");
  const [topic, setTopic] = useState("");
  const [samples, setSamples] = useState("");
  const [instructions, setInstructions] = useState("");
  const [preview, setPreview] = useState("");
  useEffect(() => {
    setThOn(Boolean(thSaved?.enabled));
    setTime(thSaved?.time_wib ?? "18:00");
    setTopic(thSaved?.topic ?? "");
    setSamples(thSaved?.samples ?? "");
    setInstructions(thSaved?.instructions ?? "");
    setPreview("");
  }, [thSaved?.key, thSaved?.enabled, thSaved?.time_wib, thSaved?.topic, thSaved?.samples, thSaved?.instructions]);

  async function save(body: object, label: string) {
    setBusy(label);
    setNote(null);
    const res = await fetch("/api/autopilot", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
    setBusy("");
    if (!res.ok) setNote({ ok: false, text: res.error ?? "Could not save." });
    else {
      setNote({ ok: true, text: "Saved." });
      load();
    }
    return res.ok as boolean;
  }

  const saveBlog = (on = blogOn) => site && save({ kind: "blog", siteId: site.id, clientId: selectedBrand, enabled: on, model: blogModel || null }, "blog-save");
  const saveThreads = (on = thOn) => save({ kind: "threads", clientId: selectedBrand, handle, enabled: on, timeWib: time, topic, samples, instructions }, "th-save");

  async function act(key: string, action: "preview" | "run", label: string) {
    if (action === "run" && !window.confirm(key.startsWith("blog") ? "Write and PUBLISH one blog post now?" : "Schedule one Threads post to go out in about 2 minutes?")) return;
    setBusy(label);
    setNote(null);
    setPreview("");
    const res = await fetch("/api/autopilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, action }) }).then((r) => r.json()).catch(() => ({ ok: false, message: "Network error" }));
    setBusy("");
    setNote({ ok: Boolean(res.ok), text: res.message ?? res.error ?? "Done." });
    if (res.text && action === "preview") setPreview(res.text);
    load();
  }

  if (error) return <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">{error}</div>;
  if (!data) return <div className="p-6 text-xs text-slate-500">Loading…</div>;

  const unused = site ? data.unusedKeywords[site.id] ?? 0 : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-xs">
        <Bot size={16} className="text-cyan-300" />
        <span className="font-semibold text-slate-200">AI writer</span>
        <span className={data.ai.claude ? "text-emerald-300" : "text-rose-300"}>● Claude {data.ai.claude ? "ready (default)" : "key missing"}</span>
        <span className={data.ai.qwen ? "text-emerald-300" : "text-slate-500"}>● Qwen {data.ai.qwen ? "ready (used when Claude is unavailable)" : "not set — add DASHSCOPE_API_KEY in Vercel to enable the fallback"}</span>
        <span className="ml-auto text-slate-500">Workspace: <b className="text-slate-300">{brandName}</b></span>
      </div>

      {note && <div className={`rounded-lg px-3 py-2 text-xs ${note.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>{note.text}</div>}

      {/* Blog */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#0e1420]/70 p-5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-black text-white">Daily blog post</h2>
          <span className="text-[11px] text-slate-500">Takes the next keyword from the keyword list, writes it, and publishes it at 09:00 WIB.</span>
          <span className="ml-auto flex items-center gap-2 text-[11px] text-slate-400">{blogOn ? "On" : "Off"}<Toggle on={blogOn} onChange={(v) => { setBlogOn(v); saveBlog(v); }} /></span>
        </div>
        {!site ? (
          <p className="mt-3 text-xs text-amber-300">This workspace has no website yet — add one under Manage Websites.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <span className={labelCls}>Website</span>
              <CustomSelect size="sm" value={site.id} onChange={setSelected} options={sitesForSelectedBrand.map((s) => ({ value: s.id, label: s.label }))} />
              <p className="mt-1.5 text-[11px] text-slate-500">{unused} unused keyword{unused === 1 ? "" : "s"} left in the list{unused === 0 && blogOn ? " — the autopilot will stop until you save more." : "."}</p>
            </div>
            <div>
              <span className={labelCls}>Claude model</span>
              <CustomSelect size="sm" value={blogModel} onChange={(v) => setBlogModel(v)} options={[{ value: "", label: "Sonnet 5 — balanced (default)" }, ...MODEL_OPTIONS.map((m) => ({ value: m.id, label: m.label }))]} />
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
              <button onClick={() => saveBlog()} disabled={busy !== ""} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50">{busy === "blog-save" ? "Saving…" : "Save"}</button>
              <button onClick={() => act(`blog:${site.id}`, "preview", "blog-prev")} disabled={busy !== "" || !blogSaved} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.1] disabled:opacity-40"><Eye size={13} />{busy === "blog-prev" ? "Writing… (1–3 min)" : "Write a draft only"}</button>
              <button onClick={() => act(`blog:${site.id}`, "run", "blog-run")} disabled={busy !== "" || !blogSaved} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.1] disabled:opacity-40"><Play size={13} />{busy === "blog-run" ? "Publishing… (1–3 min)" : "Write & publish now"}</button>
              {busy.startsWith("blog") && <Loader2 size={14} className="animate-spin text-slate-500" />}
            </div>
            <div className="sm:col-span-2"><LastRun s={blogSaved} /></div>
            <p className="sm:col-span-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
              Autopilot posts are published without the “Dari Pengalaman Kami” section, because nobody is there to fill in real experience and the AI must not invent it. Posts are checked for length (at least 500 words) first; one that fails is kept as a draft in Content Engine.
            </p>
          </div>
        )}
      </section>

      {/* Threads */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#0e1420]/70 p-5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-black text-white">Daily Threads post</h2>
          <span className="text-[11px] text-slate-500">Writes one post in the style of your samples and schedules it for the time below.</span>
          <span className="ml-auto flex items-center gap-2 text-[11px] text-slate-400">{thOn ? "On" : "Off"}<Toggle on={thOn} onChange={(v) => { setThOn(v); if (handle) saveThreads(v); }} /></span>
        </div>
        {accounts.length === 0 ? (
          <p className="mt-3 text-xs text-amber-300">No Threads account for this workspace — connect one on the Clients page.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <span className={labelCls}>Threads account</span>
              <CustomSelect size="sm" value={handle} onChange={setHandle} options={accounts.map((a) => ({ value: a.handle, label: a.connected ? a.handle : `${a.handle} (not connected)` }))} />
            </div>
            <div>
              <span className={labelCls}>Time (WIB)</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <span className={labelCls}>Topic</span>
              <CustomSelect size="sm" value={topic} onChange={setTopic} placeholder="No topic" options={[{ value: "", label: "No topic" }, ...topics.map((t) => ({ value: t.name, label: t.name }))]} />
            </div>
            <div className="sm:col-span-3">
              <span className={labelCls}>Sample posts that worked (the AI copies the style, not the words)</span>
              <textarea value={samples} onChange={(e) => setSamples(e.target.value)} rows={7} placeholder="Paste 3–6 of your best Threads posts here, separated by a blank line." className={`${inputCls} resize-y`} />
            </div>
            <div className="sm:col-span-3">
              <span className={labelCls}>Extra instructions (optional)</span>
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} placeholder="e.g. Always end with a question. Talk about Shopee and TikTok Shop sellers." className={`${inputCls} resize-y`} />
            </div>
            <div className="sm:col-span-3 flex flex-wrap items-center gap-2">
              <button onClick={() => saveThreads()} disabled={busy !== ""} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50">{busy === "th-save" ? "Saving…" : "Save"}</button>
              <button onClick={() => act(`threads:${selectedBrand}:${handle}`, "preview", "th-prev")} disabled={busy !== "" || !thSaved} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.1] disabled:opacity-40"><Eye size={13} />{busy === "th-prev" ? "Writing…" : "Preview a post"}</button>
              <button onClick={() => act(`threads:${selectedBrand}:${handle}`, "run", "th-run")} disabled={busy !== "" || !thSaved} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.1] disabled:opacity-40"><Play size={13} />{busy === "th-run" ? "Scheduling…" : "Post one now"}</button>
              <span className="text-[11px] text-slate-600">Save first, then preview. Preview posts nothing.</span>
            </div>
            {preview && (
              <div className="sm:col-span-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">Preview ({preview.length}/500)</div>
                <p className="whitespace-pre-wrap text-xs text-slate-200">{preview}</p>
              </div>
            )}
            <div className="sm:col-span-3"><LastRun s={thSaved} /></div>
          </div>
        )}
      </section>
    </div>
  );
}
