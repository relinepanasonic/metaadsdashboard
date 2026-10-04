"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Plug, Rocket, XCircle } from "lucide-react";
import CustomSelect from "@/components/CustomSelect";
import { genericSitePrompt, profesorSitePrompt } from "@/lib/seo/websitePrompts";
import { aiOfficeBlogPrompt } from "@/lib/seo/aiOfficePrompt";
import type { ConnectionState } from "@/lib/seo/classifyPublish";

interface Site {
  id: string;
  domain: string;
  label: string;
  publish_url: string | null;
  publish_secret: string | null;
  publish_cadence_per_week: number;
  parent_site_id: string | null;
  path_prefix: string | null;
}

interface TestResult {
  state: ConnectionState;
  message: string;
  httpStatus?: number;
  ms?: number;
  detail?: string;
}

interface History {
  counts: Record<string, number>;
  recent: { keyword: string; draft_title: string | null; published_url: string | null; published_at: string | null }[];
  cadencePerWeek: number;
  lastAutoPublishedAt: string | null;
}

const inputCls = "w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none";
const label = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500";

const GOOD: ConnectionState[] = ["ok", "ok-no-dryrun"];

function CopyButton({ text, children }: { text: string; children?: React.ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.1]"
    >
      {done ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
      {done ? "Copied" : children ?? "Copy"}
    </button>
  );
}

function SiteCard({ site, onChanged }: { site: Site; onChanged: () => void }) {
  const [url, setUrl] = useState(site.publish_url ?? "");
  const [secret, setSecret] = useState(site.publish_secret ?? "");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "secret" | "test">("");
  const [msg, setMsg] = useState("");
  const [test, setTest] = useState<TestResult | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const isSub = Boolean(site.parent_site_id);
  const [promptKind, setPromptKind] = useState<"profesor" | "generic">(!isSub && /^profesoronline\.id$/i.test(site.domain) ? "profesor" : "generic");

  const dirty = url.trim() !== (site.publish_url ?? "") || secret.trim() !== (site.publish_secret ?? "");
  const configured = Boolean(site.publish_url && site.publish_secret);

  useEffect(() => {
    fetch(`/api/seo/website/history?siteId=${site.id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => j.ok && setHistory(j)).catch(() => {});
  }, [site.id]);

  async function save() {
    setBusy("save");
    setMsg("");
    const res = await fetch(`/api/seo/gsc/sites/${site.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish_url: url.trim(), publish_secret: secret.trim() }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
    setBusy("");
    if (!res.ok) return setMsg(res.error || "Could not save.");
    setMsg("Saved.");
    setTest(null);
    onChanged();
  }

  async function generate() {
    if (secret && !window.confirm("Make a NEW secret? The old one stops working, so you must give the new one to the website (PUBLISH_SECRET) before publishing again.")) return;
    setBusy("secret");
    setMsg("");
    const res = await fetch("/api/seo/website/secret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId: site.id }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
    setBusy("");
    if (!res.ok) return setMsg(res.error || "Could not make a secret.");
    setSecret(res.secret);
    setReveal(true);
    setTest(null);
    setMsg("New secret saved. Copy it into the website as PUBLISH_SECRET.");
    onChanged();
  }

  async function runTest() {
    setBusy("test");
    setTest(null);
    const res = await fetch("/api/seo/website/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId: site.id }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
    setBusy("");
    if (!res.ok) return setTest({ state: "unknown", message: res.error || "Test failed." });
    setTest(res as TestResult);
  }

  const connected = test ? GOOD.includes(test.state) : null;
  const rootDomain = site.domain.split("/")[0];
  const prompt = promptKind === "profesor" ? profesorSitePrompt(rootDomain) : genericSitePrompt(rootDomain, site.path_prefix);
  const queued = history?.counts.approved ?? 0;
  const published = history?.counts.published ?? 0;

  return (
    <div className={`glass-panel p-5 sm:p-6 ${isSub ? "ml-4 border-l-2 border-l-cyan-500/30 sm:ml-8" : ""}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "rgba(34,211,238,0.1)", boxShadow: "0 0 0 1px rgba(34,211,238,0.3)" }}>
          <Plug size={18} className="text-cyan-300" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-100">{site.label}</div>
          <a href={`https://${site.domain}${isSub ? "blog" : ""}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-300">
            {isSub ? `Sub-website · ${site.domain}blog` : site.domain} <ExternalLink size={10} />
          </a>
        </div>
        <span
          className={`ml-auto rounded-full px-3 py-1 text-[11px] font-bold ${
            connected === true ? "bg-emerald-500/15 text-emerald-300" : connected === false ? "bg-rose-500/15 text-rose-300" : configured ? "bg-amber-500/15 text-amber-300" : "bg-white/[0.06] text-slate-400"
          }`}
        >
          {connected === true ? "Connected" : connected === false ? "Not working" : configured ? "Saved — not tested yet" : "Not set up"}
        </span>
      </div>

      {/* Connection form */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <span className={label}>Publish endpoint (the website&apos;s /api/publish)</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-site-or-blog-automation.vercel.app/api/publish" className={inputCls} />
        </div>
        <div>
          <span className={label}>Shared secret (PUBLISH_SECRET)</span>
          <div className="flex gap-2">
            <input
              type={reveal ? "text" : "password"}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Make one with the button →"
              autoComplete="off"
              className={`${inputCls} font-mono`}
            />
            <button type="button" onClick={() => setReveal((v) => !v)} className="shrink-0 rounded-lg bg-white/[0.06] px-2.5 text-slate-300 hover:bg-white/[0.1]" title={reveal ? "Hide" : "Show"}>
              {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            {secret && <CopyButton text={secret} />}
          </div>
          <button type="button" onClick={generate} disabled={busy !== ""} className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300 hover:underline disabled:opacity-50">
            {busy === "secret" ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />} Make a new secret
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={busy !== "" || !dirty}
          className="rounded-lg bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40"
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button
          onClick={runTest}
          disabled={busy !== "" || dirty || !configured}
          title={dirty ? "Save first" : !configured ? "Add the URL and a secret, then save" : "Checks the connection without publishing anything"}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-40"
          style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" }}
        >
          {busy === "test" ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />} Test connection
        </button>
        {msg && <span className="text-[11px] text-slate-400">{msg}</span>}
      </div>

      {test && (
        <div className={`mt-4 rounded-xl p-4 text-xs ${connected ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200"}`}>
          <div className="flex items-start gap-2">
            {connected ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : test.state === "no-target" ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
            <div>
              <div className="font-semibold">{test.message}</div>
              {(test.httpStatus || test.detail) && (
                <div className="mt-1 text-[11px] opacity-70">
                  {test.httpStatus ? `HTTP ${test.httpStatus}` : ""}{test.ms ? ` · ${test.ms} ms` : ""}{test.detail ? ` · “${test.detail}”` : ""}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Waiting to publish", v: queued, hint: "approved in Blog Engine → Content Engine" },
          { l: "Published", v: published, hint: "sent to this website" },
          { l: "Auto-publish", v: history ? (history.cadencePerWeek > 0 ? `${history.cadencePerWeek}/week` : "Off") : "—", hint: "set in Manage Websites" },
          { l: "Last auto-publish", v: history?.lastAutoPublishedAt ? new Date(history.lastAutoPublishedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—", hint: "" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl bg-white/[0.04] p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{s.l}</div>
            <div className="mt-1 text-lg font-black text-slate-100">{s.v}</div>
            {s.hint && <div className="text-[10px] text-slate-600">{s.hint}</div>}
          </div>
        ))}
      </div>

      {history && history.recent.length > 0 && (
        <div className="mt-4">
          <span className={label}>Recently published</span>
          <div className="flex flex-col divide-y divide-white/[0.05] rounded-lg bg-white/[0.03]">
            {history.recent.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-slate-200">{r.draft_title || r.keyword}</span>
                <span className="shrink-0 text-[10px] text-slate-500">{r.published_at ? new Date(r.published_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : ""}</span>
                {r.published_url && <a href={r.published_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-cyan-300 hover:underline"><ExternalLink size={12} /></a>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Website-side setup */}
      <details className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.02]" open={!configured || (test !== null && test.state === "no-endpoint")}>
        <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold text-slate-200">Set up the website side (a prompt for Claude Code in the website&apos;s project)</summary>
        <div className="border-t border-white/[0.06] px-4 py-4 text-xs leading-relaxed text-slate-400">
          <ol className="mb-3 list-decimal space-y-1 pl-4">
            <li>Open the <b className="text-slate-200">{rootDomain}</b> website project in Claude Code{isSub ? <> (the project that contains the <b className="text-slate-200">{site.path_prefix}</b> section)</> : null}.</li>
            <li>Paste the prompt below and let it build and deploy the publish endpoint. When it asks for the secret, give it the one shown above.</li>
            <li>Paste the endpoint URL it gives you into the box above, <b className="text-slate-200">Save</b>, then <b className="text-slate-200">Test connection</b>.</li>
          </ol>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {(["profesor", "generic"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setPromptKind(k)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${promptKind === k ? "bg-cyan-500/15 text-cyan-300" : "bg-white/[0.04] text-slate-400 hover:text-slate-200"}`}
              >
                {k === "profesor" ? "Profesor Toko Online site (has a written spec)" : "Any other website"}
              </button>
            ))}
            <span className="ml-auto"><CopyButton text={prompt}>Copy prompt</CopyButton></span>
          </div>
          <textarea readOnly value={prompt} rows={10} className={`${inputCls} resize-y font-mono text-[11px] leading-relaxed`} onFocus={(e) => e.currentTarget.select()} />
        </div>
      </details>
    </div>
  );
}

// The other direction: your ERP's AI Office writes a post and sends it here as a DRAFT.
function AiOfficePanel() {
  const [status, setStatus] = useState<{ configured: boolean; endpoint: string } | null>(null);
  const [secret, setSecret] = useState("");

  useEffect(() => {
    fetch("/api/seo/website/ingest-status", { cache: "no-store" }).then((r) => r.json()).then((j) => j.ok && setStatus(j)).catch(() => {});
  }, []);

  // A random value for you to copy into BOTH apps. It is made in your browser and never stored or sent anywhere.
  function makeSecret() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    setSecret(btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  }

  const endpoint = status?.endpoint ?? "";
  const prompt = aiOfficeBlogPrompt(endpoint || "https://YOUR-DIGITAL-ADS-APP/api/seo/content/import");
  return (
    <div className="glass-panel p-5 sm:p-6" style={{ boxShadow: "inset 0 0 0 1px rgba(139,92,246,0.3)" }}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "rgba(139,92,246,0.12)", boxShadow: "0 0 0 1px rgba(139,92,246,0.35)" }}>
          <Rocket size={18} className="text-violet-300" />
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-100">Write blogs from your ERP&apos;s AI Office</div>
          <div className="text-[11px] text-slate-500">The AI Office writes the article and sends it here as a draft. You review it in Blog Engine → Content Engine and publish.</div>
        </div>
        <span className={`ml-auto rounded-full px-3 py-1 text-[11px] font-bold ${status?.configured ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
          {status ? (status.configured ? "Ready to receive" : "Secret not set yet") : "…"}
        </span>
      </div>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-slate-400">
        <li>
          Make one shared secret (button below) and add it in <b className="text-slate-200">two places</b> as an environment variable: this app&apos;s Vercel project as{" "}
          <code className="rounded bg-white/[0.06] px-1 text-cyan-300">CONTENT_INGEST_SECRET</code>, and the ERP&apos;s Vercel project as{" "}
          <code className="rounded bg-white/[0.06] px-1 text-cyan-300">ADS_INGEST_SECRET</code>. Redeploy both.
        </li>
        <li>Open the <b className="text-slate-200">ERP project</b> in Claude Code and paste the prompt below. It builds the &ldquo;Send to Blog Queue&rdquo; button in the AI Office.</li>
        <li>In the AI Office, write a post and send it. It appears in <b className="text-slate-200">SEO → Blog Engine → Content Engine</b> as a draft, with the &ldquo;Dari Pengalaman Kami&rdquo; section waiting for your real experience.</li>
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={makeSecret} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.1]">
          <KeyRound size={12} /> Make a secret
        </button>
        {secret && (
          <>
            <input readOnly value={secret} onFocus={(e) => e.currentTarget.select()} className={`${inputCls} max-w-[420px] font-mono`} />
            <CopyButton text={secret} />
            <span className="text-[11px] text-slate-500">Shown only here, never saved. Put it in both Vercel projects now.</span>
          </>
        )}
      </div>

      <div className="mt-4">
        <span className={label}>Address the AI Office sends to</span>
        <div className="flex gap-2">
          <input readOnly value={endpoint} className={`${inputCls} font-mono`} />
          {endpoint && <CopyButton text={endpoint} />}
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
        <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold text-slate-200">Prompt for Claude Code in the ERP project</summary>
        <div className="border-t border-white/[0.06] px-4 py-4">
          <div className="mb-2 flex justify-end"><CopyButton text={prompt}>Copy prompt</CopyButton></div>
          <textarea readOnly value={prompt} rows={12} className={`${inputCls} resize-y font-mono text-[11px] leading-relaxed`} onFocus={(e) => e.currentTarget.select()} />
        </div>
      </details>
    </div>
  );
}

// A sub-website is one section of a main site (nanocare.id/ac-tipe-hu/) with its own blog, queue and publish target.
function AddSubsite({ roots, onAdded }: { roots: Site[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [parent, setParent] = useState(roots[0]?.id ?? "");
  const [prefix, setPrefix] = useState("/");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function add() {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/seo/gsc/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentSiteId: parent, pathPrefix: prefix, label: name }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
    setBusy(false);
    if (!res.ok) return setErr(res.error || "Could not add the sub-website.");
    setOpen(false);
    setName("");
    setPrefix("/");
    onAdded();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="self-start rounded-lg bg-white/[0.05] px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-white/[0.09]">
        + Add a sub-website (a section with its own blog, like /ac-tipe-hu/)
      </button>
    );
  }
  const valid = parent && prefix.replace(/\//g, "").trim() !== "" && name.trim() !== "";
  return (
    <div className="glass-panel p-5">
      <div className="mb-3 text-sm font-semibold text-slate-100">Add a sub-website</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <span className={label}>Main website</span>
          <CustomSelect value={parent} onChange={setParent} options={roots.map((r) => ({ value: r.id, label: r.domain }))} />
        </div>
        <div>
          <span className={label}>Path of the section</span>
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="/ac-tipe-hu/" className={inputCls} />
        </div>
        <div>
          <span className={label}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nanocare — AC Tipe HU" className={inputCls} />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Its blog would be at <span className="text-slate-300">{roots.find((r) => r.id === parent)?.domain ?? "domain"}{"/" + prefix.replace(/^\/+|\/+$/g, "")}/blog</span>. It gets its own queue of posts and its own publish endpoint.</p>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={add} disabled={busy || !valid} className="rounded-lg bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40">{busy ? "Adding…" : "Add sub-website"}</button>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
        {err && <span className="text-[11px] text-rose-300">{err}</span>}
      </div>
    </div>
  );
}

export default function WebsiteConnect() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const j = await fetch("/api/seo/gsc/sites", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
    if (j.ok) {
      setSites(j.sites as Site[]);
      setError("");
    } else setError(j.error || "Could not load websites");
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="glass-panel grid place-items-center p-10 text-xs text-slate-500"><Loader2 size={18} className="mb-2 animate-spin text-cyan-400" />Loading…</div>;
  if (error) return <div className="glass-panel p-4 text-xs text-rose-300">{error}</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel p-4 text-xs leading-relaxed text-slate-400" style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.2)" }}>
        <b className="text-slate-200">How publishing works.</b> You write and approve a post in <b className="text-slate-200">Blog Engine → Content Engine</b>, and watch each upload in <b className="text-slate-200">Blog Uploader</b>. This app then sends it to the website&apos;s own publish endpoint, which puts it on the site in the site&apos;s own design. Each website needs that endpoint once, plus a shared secret so only this app can publish. <b className="text-slate-200">Test connection</b> checks all of it without publishing anything.
      </div>
      {sites.length === 0 ? (
        <div className="glass-panel p-8 text-center text-xs text-slate-500">No websites yet. Add one in Manage Websites first.</div>
      ) : (
        <>
          {/* each main site, followed by its sub-websites */}
          {sites.filter((s) => !s.parent_site_id).flatMap((root) => [root, ...sites.filter((c) => c.parent_site_id === root.id)]).map((s) => (
            <SiteCard key={s.id} site={s} onChanged={load} />
          ))}
          <AddSubsite roots={sites.filter((s) => !s.parent_site_id)} onAdded={load} />
        </>
      )}
      <AiOfficePanel />
    </div>
  );
}
