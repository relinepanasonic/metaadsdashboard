"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink, Copy, Check, Loader2, ShieldCheck, ShieldAlert, ShieldQuestion, ShieldOff,
  RotateCcw, Trash2, ChevronRight, Info, KeyRound, Plus, Send, Pencil, Building2,
} from "lucide-react";
import CustomSelect from "@/components/CustomSelect";

interface SiteRow {
  id: string;
  domain: string;
  site_url: string | null;
  label: string;
  status: "none" | "pending" | "connected" | "error";
  last_error: string | null;
  last_synced_at: string | null;
  publish_url: string | null;
  publish_secret: string | null;
  client_id: string | null;
  created_at: string;
}

interface ClientOption {
  id: string;
  name: string;
}

const STATUS_STYLE = {
  connected: { icon: ShieldCheck, color: "#34d399", bg: "rgba(52,211,153,0.15)", label: "Search Console connected" },
  pending: { icon: ShieldQuestion, color: "#fbbf24", bg: "rgba(251,191,36,0.15)", label: "Not tested yet" },
  error: { icon: ShieldAlert, color: "#fb7185", bg: "rgba(251,113,133,0.15)", label: "Needs GSC access" },
  none: { icon: ShieldOff, color: "#64748b", bg: "rgba(100,116,139,0.15)", label: "No Search Console" },
};

// The one shared service account email every website's Search Console gets
// added to. Shown to staff to copy — they never see or handle the actual key.
const SERVICE_ACCOUNT_EMAIL_PLACEHOLDER = "your-service-account@your-project.iam.gserviceaccount.com";

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5">
      <code className="flex-1 truncate text-xs text-cyan-300">{value}</code>
      <button onClick={copy} className="flex shrink-0 items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.12]">
        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan-500/15 text-xs font-bold text-cyan-300" style={{ boxShadow: "0 0 0 1px rgba(34,211,238,0.35)" }}>
        {n}
      </span>
      <div className="flex-1 pb-1">
        <div className="mb-1.5 text-sm font-semibold text-slate-100">{title}</div>
        <div className="text-xs leading-relaxed text-slate-400">{children}</div>
      </div>
    </div>
  );
}

export default function ConnectSearchConsole({ serviceAccountEmail }: { serviceAccountEmail: string | null }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [domain, setDomain] = useState("");
  const [label, setLabel] = useState("");
  const [brandId, setBrandId] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [gscTarget, setGscTarget] = useState<string | null>(null); // site id currently wiring up GSC
  const [gscSiteUrl, setGscSiteUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [retesting, setRetesting] = useState<string | null>(null);

  const [publishTarget, setPublishTarget] = useState<string | null>(null); // site id currently editing publish target
  const [publishUrl, setPublishUrl] = useState("");
  const [publishSecret, setPublishSecret] = useState("");
  const [savingPublish, setSavingPublish] = useState(false);

  const [brandEditFor, setBrandEditFor] = useState<string | null>(null);
  const [savingBrand, setSavingBrand] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/seo/gsc/status", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/seo/gsc/sites", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/clients", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([statusJson, sitesJson, clientsJson]) => {
        if (statusJson.ok) setConfigured(statusJson.configured);
        if (sitesJson.ok) setSites(sitesJson.sites);
        if (clientsJson.ok) setClients(clientsJson.clients);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addSite() {
    if (!domain.trim() || !label.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/seo/gsc/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim(), label: label.trim(), clientId: brandId || undefined }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setDomain("");
      setLabel("");
      setBrandId("");
      load();
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function setSiteBrand(id: string, newClientId: string) {
    setSavingBrand(true);
    try {
      await fetch(`/api/seo/gsc/sites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: newClientId || null }),
      });
      setBrandEditFor(null);
      load();
    } finally {
      setSavingBrand(false);
    }
  }

  function openGscConnect(site: SiteRow) {
    setGscTarget(site.id);
    setGscSiteUrl(site.site_url ?? `sc-domain:${site.domain}`);
    setConnectError(null);
  }

  async function connectGsc() {
    if (!gscTarget || !gscSiteUrl.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const site = sites.find((s) => s.id === gscTarget);
      const res = await fetch("/api/seo/gsc/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: site?.domain, siteUrl: gscSiteUrl.trim(), label: site?.label }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      if (json.status === "error") setConnectError(json.error);
      else setGscTarget(null);
      load();
    } catch (e) {
      setConnectError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  async function retest(id: string) {
    setRetesting(id);
    try {
      await fetch(`/api/seo/gsc/sites/${id}`, { method: "POST" });
      load();
    } finally {
      setRetesting(null);
    }
  }

  async function remove(id: string, siteLabel: string) {
    if (!window.confirm(`Remove "${siteLabel}"? This deletes its saved keywords and drafts too.`)) return;
    await fetch(`/api/seo/gsc/sites/${id}`, { method: "DELETE" });
    load();
  }

  function openPublishEdit(site: SiteRow) {
    setPublishTarget(site.id);
    setPublishUrl(site.publish_url ?? "");
    setPublishSecret(site.publish_secret ?? "");
  }

  async function savePublishTarget() {
    if (!publishTarget) return;
    setSavingPublish(true);
    try {
      await fetch(`/api/seo/gsc/sites/${publishTarget}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish_url: publishUrl, publish_secret: publishSecret }),
      });
      setPublishTarget(null);
      load();
    } finally {
      setSavingPublish(false);
    }
  }

  if (loading) {
    return (
      <div className="glass-panel p-8 text-center text-sm text-slate-500">
        <Loader2 size={18} className="mx-auto mb-2 animate-spin" /> Loading your websites…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Quick add — the primary way to register a website for SEO tools */}
      <div className="glass-panel p-5">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Plus size={16} className="text-cyan-400" /> Add a Website
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Just a domain and a name — Research, Competitor Analysis, Keywords, and the Content Engine all work immediately. Search Console (below) is optional and only adds real traffic/query data.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Domain</label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSite()}
              placeholder="example.com"
              className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Display Name</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSite()}
              placeholder="Client / project name"
              className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Brand (optional)</label>
            <CustomSelect
              value={brandId}
              onChange={setBrandId}
              placeholder="No brand yet"
              options={[{ value: "", label: "No brand yet" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <button
            onClick={addSite}
            disabled={adding || !domain.trim() || !label.trim()}
            className="flex items-center gap-2 rounded-lg bg-cyan-500/15 px-5 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
          >
            {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add
          </button>
        </div>
        {addError && <div className="mt-2 text-xs text-rose-300">{addError}</div>}
      </div>

      {/* Superadmin one-time setup, only shown if not configured */}
      {!configured && (
        <div className="glass-panel p-5" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
          <div className="mb-3 flex items-center gap-2">
            <KeyRound size={16} className="text-amber-400" />
            <h3 className="text-sm font-bold text-amber-300">One-time setup needed for Search Console (Superadmin / Engineering)</h3>
          </div>
          <p className="mb-4 text-xs text-slate-400">
            Adding websites above works right now with no setup. Search Console (real traffic/query data) needs one shared Google service account created once, ever.
          </p>
          <div className="flex flex-col gap-3">
            <Step n={1} title="Create a Google Cloud project (or use an existing one)">
              Go to <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:underline">Google Cloud Console <ExternalLink size={11} /></a>.
            </Step>
            <Step n={2} title="Enable the Search Console API">
              <a href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:underline">APIs &amp; Services → Library → Search Console API <ExternalLink size={11} /></a> → Enable.
            </Step>
            <Step n={3} title="Create a Service Account">
              <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:underline">IAM &amp; Admin → Service Accounts <ExternalLink size={11} /></a> → Create Service Account.
            </Step>
            <Step n={4} title="Generate a JSON key">
              Open the service account → Keys → Add Key → Create new key → JSON.
            </Step>
            <Step n={5} title="Add two values to Vercel">
              <code className="rounded bg-white/[0.06] px-1 text-cyan-300">client_email</code> → env var <code className="rounded bg-white/[0.06] px-1 text-cyan-300">GOOGLE_SC_SERVICE_ACCOUNT_EMAIL</code>, <code className="rounded bg-white/[0.06] px-1 text-cyan-300">private_key</code> → <code className="rounded bg-white/[0.06] px-1 text-cyan-300">GOOGLE_SC_PRIVATE_KEY</code>. Redeploy.
            </Step>
          </div>
        </div>
      )}

      {/* Sites list */}
      {sites.length > 0 && (
        <div className="glass-panel p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-100">Your Websites</h3>
          <div className="flex flex-col gap-2">
            {sites.map((s) => {
              const style = STATUS_STYLE[s.status];
              const Icon = style.icon;
              const brand = clients.find((c) => c.id === s.client_id);
              return (
                <div key={s.id} className="rounded-lg border border-white/[0.06]">
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: style.bg }}>
                      <Icon size={15} style={{ color: style.color }} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100">{s.label}</div>
                      <div className="truncate text-[10px] text-slate-500">{s.domain}</div>
                    </div>

                    {brandEditFor === s.id ? (
                      <div className="flex items-center gap-1.5">
                        <CustomSelect
                          size="sm"
                          value={s.client_id ?? ""}
                          onChange={(v) => setSiteBrand(s.id, v)}
                          placeholder="Unassigned"
                          options={[{ value: "", label: "Unassigned" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
                        />
                        {savingBrand && <Loader2 size={11} className="animate-spin text-slate-500" />}
                      </div>
                    ) : (
                      <button
                        onClick={() => setBrandEditFor(s.id)}
                        className="flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-1 text-[11px] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200"
                        title="Change brand"
                      >
                        <Building2 size={11} /> {brand?.name ?? "Unassigned"}
                      </button>
                    )}

                    <span className="text-[11px] font-semibold" style={{ color: style.color }}>{style.label}</span>
                    {s.status === "error" && s.last_error && (
                      <span className="max-w-[220px] truncate text-[10px] text-rose-400" title={s.last_error}>{s.last_error}</span>
                    )}

                    <div className="ml-auto flex flex-wrap items-center gap-1.5">
                      {s.status === "connected" || s.status === "error" ? (
                        <button
                          onClick={() => retest(s.id)}
                          disabled={retesting === s.id}
                          className="flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.1]"
                        >
                          {retesting === s.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                          Retest
                        </button>
                      ) : (
                        <button
                          onClick={() => openGscConnect(s)}
                          className="flex items-center gap-1 rounded-md bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-300 hover:bg-cyan-500/20"
                        >
                          <ShieldCheck size={11} /> Connect GSC
                        </button>
                      )}
                      <button
                        onClick={() => openPublishEdit(s)}
                        className="flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.1]"
                      >
                        <Send size={11} /> Publish target
                      </button>
                      <button
                        onClick={() => remove(s.id, s.label)}
                        className="flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/20"
                      >
                        <Trash2 size={11} /> Remove
                      </button>
                    </div>
                  </div>

                  {gscTarget === s.id && (
                    <div className="border-t border-white/[0.06] p-3">
                      <p className="mb-2 text-[11px] text-slate-400">
                        In Search Console → this property → <strong className="text-slate-300">Settings → Users and permissions → Add user</strong>, paste this email (Restricted is enough):
                      </p>
                      <div className="mb-2">
                        <CopyField value={serviceAccountEmail ?? SERVICE_ACCOUNT_EMAIL_PLACEHOLDER} />
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[220px] flex-1">
                          <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Search Console property URL</label>
                          <input
                            value={gscSiteUrl}
                            onChange={(e) => setGscSiteUrl(e.target.value)}
                            placeholder={`sc-domain:${s.domain}`}
                            className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={connectGsc}
                          disabled={connecting || !gscSiteUrl.trim()}
                          className="flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                        >
                          {connecting ? <Loader2 size={13} className="animate-spin" /> : <ChevronRight size={13} />} Connect
                        </button>
                        <button onClick={() => setGscTarget(null)} className="rounded-lg bg-white/[0.05] px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.1]">
                          Cancel
                        </button>
                      </div>
                      {connectError && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                          <Info size={12} className="mt-0.5 shrink-0" /> {connectError}
                        </div>
                      )}
                    </div>
                  )}

                  {publishTarget === s.id && (
                    <div className="border-t border-white/[0.06] p-3">
                      <p className="mb-2 text-[11px] text-slate-400">
                        Where the Content Engine sends finished posts for this site — the URL of that site&apos;s blog-automation <code className="rounded bg-white/[0.06] px-1">/api/publish</code> endpoint and its shared secret.
                      </p>
                      <div className="flex flex-col gap-2">
                        <input
                          value={publishUrl}
                          onChange={(e) => setPublishUrl(e.target.value)}
                          placeholder="https://your-blog-automation.vercel.app/api/publish"
                          className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                        />
                        <input
                          value={publishSecret}
                          onChange={(e) => setPublishSecret(e.target.value)}
                          type="password"
                          placeholder="PUBLISH_SECRET"
                          className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={savePublishTarget}
                            disabled={savingPublish}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                          >
                            {savingPublish ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />} Save
                          </button>
                          <button onClick={() => setPublishTarget(null)} className="rounded-lg bg-white/[0.05] px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.1]">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
