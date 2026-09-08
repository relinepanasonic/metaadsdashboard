"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink, Copy, Check, Loader2, ShieldCheck, ShieldAlert, ShieldQuestion,
  RotateCcw, Trash2, ChevronRight, Info, KeyRound,
} from "lucide-react";

interface SiteConnection {
  id: string;
  site_url: string;
  label: string;
  status: "pending" | "connected" | "error";
  last_error: string | null;
  last_synced_at: string | null;
  created_at: string;
}

const STATUS_STYLE = {
  connected: { icon: ShieldCheck, color: "#34d399", bg: "rgba(52,211,153,0.15)", label: "Connected" },
  pending: { icon: ShieldQuestion, color: "#fbbf24", bg: "rgba(251,191,36,0.15)", label: "Not tested yet" },
  error: { icon: ShieldAlert, color: "#fb7185", bg: "rgba(251,113,133,0.15)", label: "Needs access" },
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
  const [sites, setSites] = useState<SiteConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const [siteUrl, setSiteUrl] = useState("");
  const [label, setLabel] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [retesting, setRetesting] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/seo/gsc/status", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/seo/gsc/sites", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([statusJson, sitesJson]) => {
        if (statusJson.ok) setConfigured(statusJson.configured);
        if (sitesJson.ok) setSites(sitesJson.sites);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function connect() {
    if (!siteUrl.trim() || !label.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch("/api/seo/gsc/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: siteUrl.trim(), label: label.trim() }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      if (json.status === "error") setConnectError(json.error);
      setSiteUrl("");
      setLabel("");
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
    if (!window.confirm(`Remove "${siteLabel}"? You can reconnect it anytime.`)) return;
    await fetch(`/api/seo/gsc/sites/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return (
      <div className="glass-panel p-8 text-center text-sm text-slate-500">
        <Loader2 size={18} className="mx-auto mb-2 animate-spin" /> Loading connection status…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Superadmin one-time setup, only shown if not configured */}
      {!configured && (
        <div className="glass-panel p-5" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
          <div className="mb-3 flex items-center gap-2">
            <KeyRound size={16} className="text-amber-400" />
            <h3 className="text-sm font-bold text-amber-300">One-time setup needed (Superadmin / Engineering)</h3>
          </div>
          <p className="mb-4 text-xs text-slate-400">
            Before any staff can connect a website, one shared Google service account needs to be created and its credentials added to the app. This only happens once, ever — after this, connecting a new website takes 2 minutes with no keys involved.
          </p>
          <div className="flex flex-col gap-3">
            <Step n={1} title="Create a Google Cloud project (or use an existing one)">
              Go to <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:underline">Google Cloud Console <ExternalLink size={11} /></a>, create a project named e.g. &quot;Reline SEO&quot;.
            </Step>
            <Step n={2} title="Enable the Search Console API">
              In that project, go to <a href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:underline">APIs &amp; Services → Library → Search Console API <ExternalLink size={11} /></a> and click Enable.
            </Step>
            <Step n={3} title="Create a Service Account">
              Go to <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:underline">IAM &amp; Admin → Service Accounts <ExternalLink size={11} /></a> → Create Service Account. No special roles needed — just create it.
            </Step>
            <Step n={4} title="Generate a JSON key">
              Open the new service account → Keys tab → Add Key → Create new key → JSON. A file downloads — keep it safe, it&apos;s only shown once.
            </Step>
            <Step n={5} title="Add two values to Vercel">
              In the downloaded JSON, copy the <code className="rounded bg-white/[0.06] px-1 text-cyan-300">client_email</code> value into a Vercel env var named <code className="rounded bg-white/[0.06] px-1 text-cyan-300">GOOGLE_SC_SERVICE_ACCOUNT_EMAIL</code>, and the <code className="rounded bg-white/[0.06] px-1 text-cyan-300">private_key</code> value into <code className="rounded bg-white/[0.06] px-1 text-cyan-300">GOOGLE_SC_PRIVATE_KEY</code> (keep it exactly as-is, including the <code className="rounded bg-white/[0.06] px-1 text-cyan-300">\n</code> characters). Redeploy.
            </Step>
          </div>
        </div>
      )}

      {/* Staff-facing connect flow */}
      <div className="glass-panel p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-100">Connect a Website</h3>
        <p className="mb-4 text-xs text-slate-500">Takes about 2 minutes. No passwords or API keys needed on your end.</p>

        <div className="flex flex-col gap-4">
          <Step n={1} title="Verify your website in Google Search Console">
            <p className="mb-2">If it&apos;s not already verified there, add it now — usually via a DNS TXT record or an HTML file upload (your hosting/domain provider can help).</p>
            <a
              href="https://search.google.com/search-console/welcome"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25"
              style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
            >
              Open Search Console <ExternalLink size={12} />
            </a>
          </Step>

          <Step n={2} title="Give our service account read access">
            <p className="mb-2">
              In Search Console → your property → <strong className="text-slate-300">Settings → Users and permissions → Add user</strong>. Paste this email, permission level <strong className="text-slate-300">Restricted</strong> is enough:
            </p>
            <CopyField value={serviceAccountEmail ?? SERVICE_ACCOUNT_EMAIL_PLACEHOLDER} />
          </Step>

          <Step n={3} title="Paste the site URL here">
            <p className="mb-2">Use the exact property format shown in Search Console — either a domain property (<code className="rounded bg-white/[0.06] px-1 text-cyan-300">sc-domain:example.com</code>) or a URL-prefix property (<code className="rounded bg-white/[0.06] px-1 text-cyan-300">https://example.com/</code>).</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Site URL</label>
                <input
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="sc-domain:profesoronline.id"
                  className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>
              <div className="min-w-[160px]">
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Display Name</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Prof Toko Online"
                  className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>
              <button
                onClick={connect}
                disabled={connecting || !siteUrl.trim() || !label.trim()}
                className="flex items-center gap-2 rounded-lg bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
              >
                {connecting ? <Loader2 size={13} className="animate-spin" /> : <ChevronRight size={13} />}
                Connect
              </button>
            </div>
            {connectError && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                <Info size={12} className="mt-0.5 shrink-0" /> {connectError}
              </div>
            )}
          </Step>
        </div>
      </div>

      {/* Connected sites list */}
      {sites.length > 0 && (
        <div className="glass-panel p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-100">Your Websites</h3>
          <div className="flex flex-col gap-2">
            {sites.map((s) => {
              const style = STATUS_STYLE[s.status];
              const Icon = style.icon;
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: style.bg }}>
                    <Icon size={15} style={{ color: style.color }} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100">{s.label}</div>
                    <div className="truncate text-[10px] text-slate-500">{s.site_url}</div>
                  </div>
                  <span className="text-[11px] font-semibold" style={{ color: style.color }}>{style.label}</span>
                  {s.status === "error" && s.last_error && (
                    <span className="max-w-[260px] truncate text-[10px] text-rose-400" title={s.last_error}>{s.last_error}</span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      onClick={() => retest(s.id)}
                      disabled={retesting === s.id}
                      className="flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.1]"
                    >
                      {retesting === s.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                      Retest
                    </button>
                    <button
                      onClick={() => remove(s.id, s.label)}
                      className="flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/20"
                    >
                      <Trash2 size={11} /> Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
