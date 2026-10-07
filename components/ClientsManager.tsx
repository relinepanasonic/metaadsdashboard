"use client";

import { Fragment, useEffect, useState } from "react";
import CustomSelect from "@/components/CustomSelect";
import { Plus, Pencil, Trash2, Check, X, Loader2, Search, Globe2, Share2, Camera, ThumbsUp } from "lucide-react";
import { PLATFORM_LABEL, PUBLISH_ONLY_PLATFORMS, type Platform } from "@/lib/services/scheduler";

interface SocialAccount {
  id: string;
  platform: "instagram" | "facebook";
  external_id: string;
  handle: string | null;
}

// Threads / X / TikTok / YouTube accounts: used for scheduled posting only.
interface PublishProfile {
  id: string;
  platform: Platform;
  handle: string | null;
  external_id: string | null;
  login_expires?: string; // Threads only: when the stored login runs out
}

interface Client {
  id: string;
  name: string;
  owner: string | null;
  pic: string | null;
  contact_email: string | null;
  website_domain: string | null;
  meta_ad_account_id: string | null;
  google_ads_account_id: string | null;
  created_at: string;
  social: SocialAccount[];
  publishing: PublishProfile[];
}

type FormFields = {
  name: string;
  owner: string;
  websiteDomain: string;
  metaAdAccountId: string;
  googleAdsAccountId: string;
};

const EMPTY_FORM: FormFields = { name: "", owner: "", websiteDomain: "", metaAdAccountId: "", googleAdsAccountId: "" };

function Cell({ value, placeholder }: { value: string | null; placeholder: string }) {
  return value ? <span className="text-slate-200">{value}</span> : <span className="text-slate-600">{placeholder}</span>;
}

// Small coloured tag for the publishing-only platforms.
const PUBLISH_TAG: Record<string, { text: string; cls: string }> = {
  threads: { text: "Th", cls: "bg-slate-200/15 text-slate-200" },
  x: { text: "X", cls: "bg-slate-100/15 text-slate-100" },
  tiktok: { text: "TT", cls: "bg-cyan-400/15 text-cyan-300" },
  youtube: { text: "YT", cls: "bg-red-500/15 text-red-300" },
};

function ProfileChip({ a }: { a: PublishProfile }) {
  const t = PUBLISH_TAG[a.platform];
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-300" title={PLATFORM_LABEL[a.platform]}>
      <span className={`grid h-[15px] min-w-[19px] place-items-center rounded px-1 text-[8px] font-black ${t?.cls ?? ""}`}>{t?.text ?? "?"}</span>
      {a.handle || a.external_id}
    </span>
  );
}

function AccountChip({ a }: { a: SocialAccount }) {
  const Icon = a.platform === "instagram" ? Camera : ThumbsUp;
  const color = a.platform === "instagram" ? "text-pink-400" : "text-blue-400";
  return (
    <span className="inline-flex items-center gap-1 text-slate-300">
      <Icon size={11} className={color} /> {a.handle || a.external_id}
    </span>
  );
}

export default function ClientsManager({ canDelete }: { canDelete: boolean }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<FormFields>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormFields>(EMPTY_FORM);
  const [socialOpenId, setSocialOpenId] = useState<string | null>(null);

  function load() {
    fetch("/api/clients", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setClients(j.clients))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Threads sends the person back here after login: show how it went, then tidy the address bar.
  const [threadsNote, setThreadsNote] = useState<{ ok: boolean; msg: string } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("threads");
    if (r) {
      setThreadsNote({ ok: r === "connected", msg: q.get("msg") ?? "" });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function createClient() {
    if (!addForm.name.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    }).then((r) => r.json());
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAddForm(EMPTY_FORM);
    setAdding(false);
    load();
    setSocialOpenId(res.id); // straight on to linking its Instagram / Facebook accounts
  }

  function startEdit(c: Client) {
    setEditId(c.id);
    setEditForm({
      name: c.name,
      owner: c.owner ?? "",
      websiteDomain: c.website_domain ?? "",
      metaAdAccountId: c.meta_ad_account_id ?? "",
      googleAdsAccountId: c.google_ads_account_id ?? "",
    });
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/clients/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    }).then((r) => r.json());
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditId(null);
    load();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove "${name}"? This won't delete its SEO #1 website — that becomes unlinked.`)) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    load();
  }

  const visible = filter
    ? clients.filter((c) => `${c.name} ${c.owner ?? ""} ${c.website_domain ?? ""}`.toLowerCase().includes(filter.toLowerCase()))
    : clients;

  if (loading) return <div className="glass-panel p-6 text-center text-xs text-slate-500">Loading clients&hellip;</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter clients…"
            className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] py-2 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25"
          style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
        >
          <Plus size={13} /> Add Client
        </button>
      </div>

      {adding && (
        <div className="glass-panel p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <LabeledInput label="Brand *" value={addForm.name} onChange={(v) => setAddForm((f) => ({ ...f, name: v }))} placeholder="Client / brand name" />
            <LabeledInput label="Owner" value={addForm.owner} onChange={(v) => setAddForm((f) => ({ ...f, owner: v }))} placeholder="Client's business owner" />
            <LabeledInput label="Website" value={addForm.websiteDomain} onChange={(v) => setAddForm((f) => ({ ...f, websiteDomain: v }))} placeholder="example.com" />
            <LabeledInput label="Meta Ads account" value={addForm.metaAdAccountId} onChange={(v) => setAddForm((f) => ({ ...f, metaAdAccountId: v }))} placeholder="Ad account id" />
            <LabeledInput label="Google Ads account" value={addForm.googleAdsAccountId} onChange={(v) => setAddForm((f) => ({ ...f, googleAdsAccountId: v }))} placeholder="Customer id" />
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Instagram accounts and Facebook Pages are added right after you save — a client can have as many of each as needed.</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={createClient}
              disabled={saving || !addForm.name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
            </button>
            <button onClick={() => setAdding(false)} className="rounded-lg bg-white/[0.05] px-4 py-2 text-xs text-slate-400 hover:bg-white/[0.1]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {threadsNote && (
        <div className={`mb-3 flex items-center justify-between rounded-lg px-3 py-2 text-xs ${threadsNote.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
          <span>{threadsNote.ok ? "✓ " : ""}Threads: {threadsNote.msg}</span>
          <button onClick={() => setThreadsNote(null)} className="text-slate-400 hover:text-white"><X size={12} /></button>
        </div>
      )}
      {error && (
        <div className="glass-panel p-3 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
          {error}
        </div>
      )}

      <div className="glass-panel overflow-x-auto p-4 sm:p-5">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2.5 font-semibold">Client ID</th>
              <th className="px-3 py-2.5 font-semibold">Owner</th>
              <th className="px-3 py-2.5 font-semibold">Brand</th>
              <th className="px-3 py-2.5 font-semibold">Website</th>
              <th className="px-3 py-2.5 font-semibold">Meta Ads</th>
              <th className="px-3 py-2.5 font-semibold">Social accounts</th>
              <th className="px-3 py-2.5 font-semibold">Google</th>
              <th className="px-3 py-2.5 text-right font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">No clients yet.</td>
              </tr>
            ) : (
              visible.map((c) => {
                const isEditing = editId === c.id;
                const socialOpen = socialOpenId === c.id;

                const socialCell = (
                  <div className="flex flex-col items-start gap-0.5">
                    {c.social.length + c.publishing.length === 0 ? (
                      <span className="text-slate-600">—</span>
                    ) : (
                      <>
                        {c.social.slice(0, 3).map((a) => (
                          <AccountChip key={a.id} a={a} />
                        ))}
                        {c.publishing.slice(0, Math.max(0, 5 - Math.min(c.social.length, 3))).map((a) => (
                          <ProfileChip key={a.id} a={a} />
                        ))}
                        {c.social.length + c.publishing.length > 5 && <span className="text-[10px] text-slate-500">+{c.social.length + c.publishing.length - 5} more</span>}
                      </>
                    )}
                    <button onClick={() => setSocialOpenId(socialOpen ? null : c.id)} className="mt-0.5 text-[10px] font-semibold text-cyan-300 hover:underline">
                      {socialOpen ? "Close" : c.social.length + c.publishing.length === 0 ? "Add accounts" : "Manage"}
                    </button>
                  </div>
                );

                return (
                  <Fragment key={c.id}>
                    {isEditing ? (
                      <tr className="border-t border-white/[0.05] bg-white/[0.02]">
                        <td className="px-3 py-2 font-mono text-[10px] text-slate-600">{c.id.slice(0, 8)}</td>
                        <td className="px-3 py-2"><RowInput value={editForm.owner} onChange={(v) => setEditForm((f) => ({ ...f, owner: v }))} /></td>
                        <td className="px-3 py-2"><RowInput value={editForm.name} onChange={(v) => setEditForm((f) => ({ ...f, name: v }))} /></td>
                        <td className="px-3 py-2"><RowInput value={editForm.websiteDomain} onChange={(v) => setEditForm((f) => ({ ...f, websiteDomain: v }))} placeholder="example.com" /></td>
                        <td className="px-3 py-2"><RowInput value={editForm.metaAdAccountId} onChange={(v) => setEditForm((f) => ({ ...f, metaAdAccountId: v }))} /></td>
                        <td className="px-3 py-2">{socialCell}</td>
                        <td className="px-3 py-2"><RowInput value={editForm.googleAdsAccountId} onChange={(v) => setEditForm((f) => ({ ...f, googleAdsAccountId: v }))} /></td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={saveEdit} disabled={saving} className="rounded-md p-1.5 text-emerald-400 hover:bg-emerald-500/10">
                              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            </button>
                            <button onClick={() => setEditId(null)} className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.08]">
                              <X size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 font-mono text-[10px] text-slate-600">{c.id.slice(0, 8)}</td>
                        <td className="px-3 py-2.5"><Cell value={c.owner} placeholder="—" /></td>
                        <td className="px-3 py-2.5 font-semibold text-slate-100">{c.name}</td>
                        <td className="px-3 py-2.5">
                          {c.website_domain ? (
                            <a href={`https://${c.website_domain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:underline">
                              <Globe2 size={11} /> {c.website_domain}
                            </a>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {c.meta_ad_account_id ? (
                            <span className="inline-flex items-center gap-1 text-slate-300"><Share2 size={11} className="text-blue-400" /> {c.meta_ad_account_id}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">{socialCell}</td>
                        <td className="px-3 py-2.5"><Cell value={c.google_ads_account_id} placeholder="—" /></td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => startEdit(c)} className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.08] hover:text-slate-200">
                              <Pencil size={12} />
                            </button>
                            {canDelete && (
                              <button onClick={() => remove(c.id, c.name)} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    {socialOpen && (
                      <tr className="bg-white/[0.02]">
                        <td colSpan={8} className="px-3 pb-4 pt-1">
                          <AccountsEditor client={c} onChanged={load} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
      />
    </label>
  );
}

function RowInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-white/[0.12] bg-[#0b0e14] px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
    />
  );
}

type Found = { id: string; label: string };

// One place to manage every account of a client: Instagram and Facebook (their numbers
// also feed the Social Media dashboard) and Threads, X, TikTok and YouTube (used only
// for scheduled posting). Instagram / Facebook are added by ID (pick from what the Meta
// token can list, or paste an ID and press Check); the others only need a username.
type AnyPlatform = "instagram" | "facebook" | Platform;

const PLATFORM_OPTIONS: { value: AnyPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook Page" },
  { value: "threads", label: "Threads" },
  { value: "x", label: "X" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube Shorts" },
];

const inputCls = "w-full rounded-md border border-white/[0.12] bg-[#0b0e14] px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none";
const fieldLabel = "mb-1 text-[10px] uppercase tracking-wider text-slate-500";

function AccountsEditor({ client, onChanged }: { client: Client; onChanged: () => void }) {
  const [platform, setPlatform] = useState<AnyPlatform>("instagram");
  const [externalId, setExternalId] = useState("");
  const [handle, setHandle] = useState("");
  const [serviceId, setServiceId] = useState(""); // account id in the posting service (Zernio), for Threads / X / TikTok / YouTube
  const [found, setFound] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState<"" | "find" | "check" | "add">("");
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const needsId = platform === "instagram" || platform === "facebook";
  const total = client.social.length + client.publishing.length;

  function reset(p: AnyPlatform) {
    setPlatform(p);
    setExternalId("");
    setHandle("");
    setServiceId("");
    setFound(null);
    setErr("");
    setOkMsg("");
  }

  async function find() {
    setBusy("find");
    setErr("");
    const res = await fetch(platform === "instagram" ? "/api/instagram/discover" : "/api/facebook/discover", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Request failed" }));
    setBusy("");
    if (!res.ok) return setErr(res.error);
    setFound(
      platform === "instagram"
        ? (res.accounts as { id: string; username: string; pageName: string }[]).map((a) => ({ id: a.id, label: `@${a.username} (${a.pageName})` }))
        : (res.pages as { id: string; name: string }[]).map((p) => ({ id: p.id, label: p.name }))
    );
  }

  async function check() {
    setBusy("check");
    setErr("");
    setOkMsg("");
    const res = await fetch(`/api/${platform}/lookup?id=${encodeURIComponent(externalId.trim())}`, { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Request failed" }));
    setBusy("");
    if (!res.ok) return setErr(res.error);
    setHandle(platform === "instagram" ? `@${res.username}` : res.name);
    setOkMsg(`${platform === "instagram" ? `@${res.username}` : res.name} · ${Number(res.followers).toLocaleString("en-US")} followers`);
  }

  async function add() {
    setBusy("add");
    setErr("");
    const res = await (needsId
      ? fetch("/api/social/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: client.id, platform, externalId, handle }),
        })
      : fetch("/api/scheduler/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: client.id, platform, handle, externalId: serviceId }),
        })
    )
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Request failed" }));
    setBusy("");
    if (!res.ok) return setErr(res.error);
    reset(platform);
    onChanged();
  }

  async function unlinkSocial(a: SocialAccount) {
    if (!window.confirm(`Unlink ${a.handle || a.external_id} from ${client.name}? Its stored history is kept.`)) return;
    await fetch(`/api/social/accounts/${a.id}`, { method: "DELETE" });
    onChanged();
  }

  async function removeProfile(a: PublishProfile) {
    if (!window.confirm(`Remove ${a.handle ?? "this account"} from ${client.name}? Posts already queued for it stay as they are.`)) return;
    await fetch(`/api/scheduler/profiles?id=${a.id}`, { method: "DELETE" });
    onChanged();
  }

  const canAdd = needsId ? externalId.trim() !== "" : handle.trim() !== "";

  return (
    <div className="max-w-[560px] rounded-lg border border-white/[0.07] bg-[#0b0e14]/60 p-3.5">
      <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Accounts for {client.name} ({total})
      </div>

      {/* Everything linked, one per line */}
      {total === 0 ? (
        <div className="mb-3 text-xs text-slate-600">Nothing linked yet.</div>
      ) : (
        <div className="mb-4 flex flex-col divide-y divide-white/[0.05] rounded-md bg-white/[0.03]">
          {client.social.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-3 py-2 text-xs">
              <AccountChip a={a} />
              <span className="font-mono text-[9px] text-slate-600">{a.external_id}</span>
              <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300" title="Its numbers appear on the Social Media dashboard, and you can post to it from the Scheduler">Dashboard + posting</span>
              <button onClick={() => unlinkSocial(a)} title="Unlink" className="text-slate-500 hover:text-rose-300"><X size={12} /></button>
            </div>
          ))}
          {client.publishing.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-3 py-2 text-xs">
              <ProfileChip a={a} />
              {a.external_id && <span className="font-mono text-[9px] text-slate-600" title="Account ID in the posting service">{a.external_id}</span>}
              {a.platform === "threads" ? (
                a.login_expires ? (
                  <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300" title="Posts straight to Threads from this app. The login renews itself.">Connected</span>
                ) : (
                  <a href={`/api/threads/connect?clientId=${client.id}`} className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold text-amber-300 hover:bg-amber-500/25" title="Log in with Threads once so this app can post for the account">Connect</a>
                )
              ) : (
                <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-semibold text-slate-400" title="Used only for scheduled posting">Posting only</span>
              )}
              <button onClick={() => removeProfile(a)} title="Remove" className="text-slate-500 hover:text-rose-300"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Add one */}
      <div className="flex flex-col gap-2.5 border-t border-white/[0.06] pt-3.5">
        <div className="text-[11px] font-semibold text-slate-300">Add an account</div>

        <div>
          <div className={fieldLabel}>Platform</div>
          <CustomSelect size="sm" value={platform} onChange={(v) => reset(v as AnyPlatform)} options={PLATFORM_OPTIONS} />
        </div>

        {needsId ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={find} disabled={busy !== ""} className="text-[11px] font-semibold text-cyan-300 hover:underline disabled:opacity-50">
                {busy === "find" ? "Searching…" : platform === "instagram" ? "Find Instagram accounts" : "Find Facebook Pages"}
              </button>
              {found && found.length === 0 && <span className="text-[11px] text-amber-300">None listed — paste the ID from Business Settings and press Check ID.</span>}
            </div>
            {found && found.length > 0 && (
              <div>
                <div className={fieldLabel}>Pick one</div>
                <CustomSelect
                  size="sm"
                  value=""
                  placeholder="Choose from the list…"
                  onChange={(id) => {
                    const f = found.find((x) => x.id === id);
                    if (!f) return;
                    setExternalId(f.id);
                    setHandle(f.label.replace(/ \(.*\)$/, ""));
                    setOkMsg("");
                  }}
                  options={found.map((f) => ({ value: f.id, label: f.label }))}
                />
              </div>
            )}
            <div>
              <div className={fieldLabel}>{platform === "instagram" ? "Instagram account ID" : "Facebook Page ID"}</div>
              <input
                value={externalId}
                onChange={(e) => { setExternalId(e.target.value); setOkMsg(""); }}
                placeholder={platform === "instagram" ? "e.g. 17841435173358588" : "e.g. 915005651703515"}
                className={inputCls}
              />
            </div>
            <div>
              <div className={fieldLabel}>{platform === "instagram" ? "Handle" : "Page name"}</div>
              <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="filled by Check ID" className={inputCls} />
            </div>
          </>
        ) : platform === "threads" ? (
          <div>
            <a href={`/api/threads/connect?clientId=${client.id}`} className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25">
              <Plus size={12} /> Connect a Threads account
            </a>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
              You log in with Threads once and approve posting. This app then posts to the account itself, with carousels and topics, and no Make.com. Use the account owner&apos;s login.
            </p>
          </div>
        ) : (
          <div>
            <div className={fieldLabel}>{platform === "youtube" ? "Channel name" : "Username"}</div>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canAdd && add()}
              placeholder="@username"
              className={inputCls}
            />
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">
              A label so you can pick the right account when scheduling. The login for {PLATFORM_LABEL[platform as Platform]} is connected once in Make.com or in your posting service.
            </p>
            <div className={`${fieldLabel} mt-3`}>Posting-service account ID (optional)</div>
            <input value={serviceId} onChange={(e) => setServiceId(e.target.value)} placeholder="e.g. the account ID shown in Zernio" className={inputCls} />
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">
              With a posting service such as Zernio, put the account&apos;s ID here. Make then picks the right account from the job, so one route serves every account.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          {needsId && (
            <button onClick={check} disabled={!externalId.trim() || busy !== ""} className="rounded-md bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.1] disabled:opacity-40">
              {busy === "check" ? "Checking…" : "Check ID"}
            </button>
          )}
          {platform !== "threads" && <button onClick={add} disabled={!canAdd || busy !== ""} className="flex items-center gap-1 rounded-md bg-emerald-500/15 px-4 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40">
            {busy === "add" ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add account
          </button>}
        </div>

        {okMsg && <div className="text-[11px] text-emerald-300">✓ {okMsg}</div>}
        {err && <div className="text-[11px] text-rose-300">{err}</div>}
      </div>
    </div>
  );
}
