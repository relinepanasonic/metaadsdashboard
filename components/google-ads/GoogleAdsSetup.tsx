"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Copy, ExternalLink, Plug, RefreshCw } from "lucide-react";
import type { AccountsResponse } from "./GoogleAdsDashboard";

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="pt-0.5">{done ? <CheckCircle2 size={20} className="text-emerald-400" /> : <Circle size={20} className="text-slate-600" />}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-100">{n}. {title}</div>
        <div className="mt-1 text-xs leading-relaxed text-slate-400">{children}</div>
      </div>
    </div>
  );
}

const code = "rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-cyan-300";

export default function GoogleAdsSetup({
  canConnect,
  accounts,
  reload,
  onSynced,
}: {
  canConnect: boolean;
  accounts: AccountsResponse | null;
  reload: (live?: boolean) => Promise<unknown>;
  onSynced: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [finding, setFinding] = useState(false);
  const [copied, setCopied] = useState(false);

  const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/api/google-ads/oauth/callback` : "";
  const oauthOk = accounts?.oauthConfigured ?? false;
  const connected = accounts?.configured ?? false;

  async function find() {
    setFinding(true);
    setMsg("");
    await reload(true);
    setFinding(false);
  }

  async function sync(customerId: string, days: number) {
    setBusy(customerId);
    setMsg("");
    try {
      const j = await fetch("/api/google-ads/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, days }) }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error);
      const r = j.results?.[0];
      setMsg(`Synced ${r?.name ?? customerId}: ${r?.campaignDays ?? 0} campaign-days, ${r?.items ?? 0} keyword/term/ad rows${r?.errors?.length ? ` · skipped: ${r.errors.slice(0, 2).join("; ")}` : ""}.`);
      await reload();
      onSynced();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="glass-panel p-5 sm:p-6" style={{ boxShadow: "inset 0 0 0 1px rgba(59,130,246,0.25)" }}>
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "rgba(59,130,246,0.12)", boxShadow: "0 0 0 1px rgba(59,130,246,0.4)" }}>
          <Plug size={20} className="text-cyan-400" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Connect Google Ads</h2>
          <p className="text-xs text-slate-500">One-time setup · about 10 minutes · uses the free Google Ads API tier (Explorer access, no approval wait)</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <Step n={1} done={oauthOk} title="Create the Google sign-in keys">
          <ol className="list-decimal space-y-1 pl-4">
            <li>Open <a className="text-cyan-300 underline" href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">Google Cloud Console <ExternalLink size={10} className="inline" /></a> and create a project (or pick an existing one).</li>
            <li>In <b>APIs &amp; Services → Library</b>, enable <b>Google Ads API</b>.</li>
            <li><b>OAuth consent screen</b> → External → fill the app name and your email → add the scope <span className={code}>.../auth/adwords</span> → set publishing status to <b>In production</b> (in “Testing” Google expires the token after 7 days).</li>
            <li><b>Credentials → Create credentials → OAuth client ID → Web application</b>. Add this exact <b>Authorized redirect URI</b>:
              <div className="mt-1 flex items-center gap-2">
                <span className={`${code} break-all`}>{redirectUri || "…/api/google-ads/oauth/callback"}</span>
                <button onClick={() => { navigator.clipboard?.writeText(redirectUri); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded p-1 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200" title="Copy">
                  <Copy size={12} />
                </button>
                {copied && <span className="text-[10px] text-emerald-300">Copied</span>}
              </div>
            </li>
            <li>In <b>Vercel → Settings → Environment Variables</b> add <span className={code}>GOOGLE_ADS_CLIENT_ID</span> and <span className={code}>GOOGLE_ADS_CLIENT_SECRET</span> from that client, then redeploy. <i>Enter them in Vercel yourself — never paste secrets in chat.</i></li>
          </ol>
        </Step>

        <Step n={2} done={connected} title="Authorize with the Google login that can see the ads">
          {canConnect ? (
            <>
              <p>Sign in with the Google account that has access to the Google Ads account(s). You will get a one-time refresh token to paste into Vercel as <span className={code}>GOOGLE_ADS_REFRESH_TOKEN</span> (then redeploy). If those accounts sit under a manager (MCC) account, also add its 10-digit ID as <span className={code}>GOOGLE_ADS_LOGIN_CUSTOMER_ID</span>.</p>
              <a
                href={oauthOk ? "/api/google-ads/oauth/start" : undefined}
                aria-disabled={!oauthOk}
                className={`mt-2 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${oauthOk ? "bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25" : "cursor-not-allowed bg-white/[0.04] text-slate-600"}`}
                style={oauthOk ? { boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" } : undefined}
              >
                <ExternalLink size={13} /> {connected ? "Re-authorize Google" : "Connect Google account"}
              </a>
              {!oauthOk && <span className="ml-2 text-[11px] text-slate-500">Finish step 1 first.</span>}
            </>
          ) : (
            <p>A Founder or Superadmin needs to do this step.</p>
          )}
        </Step>

        <Step n={3} done={(accounts?.accounts.length ?? 0) > 0} title="Pick the accounts to pull in">
          <p>Find the accounts your login can open, then sync each once — the first sync backfills 180 days of history. After that a nightly job keeps it current. Link each account to its brand on the <a className="text-cyan-300 underline" href="/clients">Clients</a> page (Google Ads account ID) so that brand’s client login sees it.</p>
          <button
            onClick={find}
            disabled={!connected || finding}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-40"
            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
          >
            <RefreshCw size={13} className={finding ? "animate-spin" : ""} /> {finding ? "Asking Google…" : "Find my Google Ads accounts"}
          </button>
          {!connected && <span className="ml-2 text-[11px] text-slate-500">Finish step 2 first.</span>}

          {accounts?.liveError && <div className="mt-2 rounded-lg bg-rose-500/10 p-2.5 text-rose-300">{accounts.liveError}</div>}

          {accounts?.live && (
            <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.08]">
              {accounts.live.length === 0 && <div className="p-3 text-slate-500">This login has no accessible Google Ads accounts.</div>}
              {accounts.live.map((a) => (
                <div key={a.customerId} className="flex flex-wrap items-center gap-3 border-b border-white/[0.05] px-3 py-2.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-100">{a.name}</div>
                    <div className="text-[10px] text-slate-500">{a.customerId.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}{a.currency ? ` · ${a.currency}` : ""}{a.brand ? ` · brand: ${a.brand}` : " · not linked to a brand yet"}</div>
                  </div>
                  <button
                    onClick={() => sync(a.customerId, 180)}
                    disabled={busy === a.customerId}
                    className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    {busy === a.customerId ? "Syncing…" : "Sync 180 days"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {accounts && accounts.accounts.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Already syncing</div>
              <div className="overflow-hidden rounded-xl border border-white/[0.08]">
                {accounts.accounts.map((a) => (
                  <div key={a.customer_id} className="flex flex-wrap items-center gap-3 border-b border-white/[0.05] px-3 py-2 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-100">{a.name ?? a.customer_id}</div>
                      <div className="text-[10px] text-slate-500">
                        {a.brand ? `brand: ${a.brand}` : "no brand linked"} · {a.last_synced_at ? `synced ${new Date(a.last_synced_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}` : "never synced"}
                        {a.last_error ? ` · ${a.last_error}` : ""}
                      </div>
                    </div>
                    <button onClick={() => sync(a.customer_id, 30)} disabled={busy === a.customer_id} className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-white/[0.06] disabled:opacity-50">
                      {busy === a.customer_id ? "Syncing…" : "Sync 30 days"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {accounts && accounts.unsyncedBrands.length > 0 && (
            <div className="mt-3 rounded-lg bg-amber-500/10 p-2.5 text-amber-300">
              Linked on the Clients page but not synced yet: {accounts.unsyncedBrands.map((b) => `${b.brand} (${b.customerId})`).join(", ")}. The nightly job will pick them up, or use “Find my Google Ads accounts” and sync now.
            </div>
          )}
          {msg && <div className="mt-3 rounded-lg bg-white/[0.04] p-2.5 text-slate-300">{msg}</div>}
        </Step>
      </div>
    </div>
  );
}
