"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2, Search, Globe2, Share2, Camera } from "lucide-react";

interface Client {
  id: string;
  name: string;
  owner: string | null;
  pic: string | null;
  contact_email: string | null;
  website_domain: string | null;
  instagram_handle: string | null;
  meta_ad_account_id: string | null;
  google_ads_account_id: string | null;
  created_at: string;
}

type FormFields = {
  name: string;
  owner: string;
  websiteDomain: string;
  instagramHandle: string;
  metaAdAccountId: string;
  googleAdsAccountId: string;
};

const EMPTY_FORM: FormFields = { name: "", owner: "", websiteDomain: "", instagramHandle: "", metaAdAccountId: "", googleAdsAccountId: "" };

function Cell({ value, placeholder }: { value: string | null; placeholder: string }) {
  return value ? <span className="text-slate-200">{value}</span> : <span className="text-slate-600">{placeholder}</span>;
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

  function load() {
    setLoading(true);
    fetch("/api/clients", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setClients(j.clients))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

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
  }

  function startEdit(c: Client) {
    setEditId(c.id);
    setEditForm({
      name: c.name,
      owner: c.owner ?? "",
      websiteDomain: c.website_domain ?? "",
      instagramHandle: c.instagram_handle ?? "",
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
            <LabeledInput label="Camera" value={addForm.instagramHandle} onChange={(v) => setAddForm((f) => ({ ...f, instagramHandle: v }))} placeholder="@handle" />
            <LabeledInput label="Google Ads account" value={addForm.googleAdsAccountId} onChange={(v) => setAddForm((f) => ({ ...f, googleAdsAccountId: v }))} placeholder="Customer id" />
          </div>
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
              <th className="px-3 py-2.5 font-semibold">Camera</th>
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
                if (isEditing) {
                  return (
                    <tr key={c.id} className="border-t border-white/[0.05] bg-white/[0.02]">
                      <td className="px-3 py-2 font-mono text-[10px] text-slate-600">{c.id.slice(0, 8)}</td>
                      <td className="px-3 py-2"><RowInput value={editForm.owner} onChange={(v) => setEditForm((f) => ({ ...f, owner: v }))} /></td>
                      <td className="px-3 py-2"><RowInput value={editForm.name} onChange={(v) => setEditForm((f) => ({ ...f, name: v }))} /></td>
                      <td className="px-3 py-2"><RowInput value={editForm.websiteDomain} onChange={(v) => setEditForm((f) => ({ ...f, websiteDomain: v }))} placeholder="example.com" /></td>
                      <td className="px-3 py-2"><RowInput value={editForm.metaAdAccountId} onChange={(v) => setEditForm((f) => ({ ...f, metaAdAccountId: v }))} /></td>
                      <td className="px-3 py-2"><RowInput value={editForm.instagramHandle} onChange={(v) => setEditForm((f) => ({ ...f, instagramHandle: v }))} /></td>
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
                  );
                }
                return (
                  <tr key={c.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
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
                    <td className="px-3 py-2.5">
                      {c.instagram_handle ? (
                        <span className="inline-flex items-center gap-1 text-slate-300"><Camera size={11} className="text-pink-400" /> {c.instagram_handle}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
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
