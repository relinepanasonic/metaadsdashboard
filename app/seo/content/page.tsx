"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Factory, Sparkles, Send, ExternalLink, AlertTriangle, Save, Bookmark, Globe2 } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { FIRSTHAND_MARKER } from "@/lib/seo/constants";
import { useSeoSite } from "@/components/seo/SeoSiteProvider";

const TAGS = ["Optimization", "Indonesia News", "Foreign Sellers", "Consumer Behavior", "Case Study"];

interface Item {
  id: string;
  keyword: string;
  volume: number | null;
  status: "idea" | "drafted" | "published";
  draft_title: string | null;
  draft_slug: string | null;
  draft_meta: string | null;
  draft_excerpt: string | null;
  draft_html: string | null;
  draft_tag: string | null;
  published_url: string | null;
  published_at: string | null;
}

export default function ContentPage() {
  const { sites, selected, selectedSite, loading: loadingSites } = useSeoSite();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selected) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/seo/content?siteId=${selected}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setItems(j.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selected]);

  function patchItem(id: string, fields: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...fields } : it)));
  }

  async function draft(id: string) {
    setBusyId(id);
    setError("");
    const res = await fetch("/api/seo/content/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then((r) => r.json());
    setBusyId(null);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    patchItem(id, {
      status: "drafted",
      draft_title: res.draft.title,
      draft_slug: res.draft.slug,
      draft_meta: res.draft.metaDescription,
      draft_excerpt: res.draft.excerpt,
      draft_html: res.draft.bodyHtml,
      draft_tag: res.draft.tag,
    });
    setOpenId(id);
  }

  async function saveDraft(item: Item) {
    setSaving(true);
    await fetch("/api/seo/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        draft_title: item.draft_title,
        draft_slug: item.draft_slug,
        draft_meta: item.draft_meta,
        draft_excerpt: item.draft_excerpt,
        draft_html: item.draft_html,
        draft_tag: item.draft_tag,
      }),
    });
    setSaving(false);
  }

  async function publish(item: Item) {
    await saveDraft(item);
    setBusyId(item.id);
    setError("");
    const res = await fetch("/api/seo/content/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    }).then((r) => r.json());
    setBusyId(null);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    patchItem(item.id, { status: "published", published_url: res.url, published_at: new Date().toISOString() });
    setOpenId(null);
  }

  if (loadingSites || loading) return <div className="glass-panel p-6 text-center text-xs text-slate-500">Loading&hellip;</div>;

  if (sites.length === 0) {
    return (
      <div className="glass-panel p-8 text-center">
        <Globe2 size={28} className="mx-auto mb-3 text-slate-600" />
        <div className="text-sm font-semibold text-slate-300">No websites added yet</div>
        <div className="mt-1 text-xs text-slate-500">Add a website in Manage Websites to start writing content for it.</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass-panel p-8 text-center">
        <Factory size={28} className="mx-auto mb-3 text-slate-600" />
        <div className="text-sm font-semibold text-slate-300">No keywords to write about yet — {selectedSite?.label}</div>
        <div className="mt-1 text-xs text-slate-500">
          Save keywords in <Link href="/seo/research" className="text-cyan-300 hover:underline">Research</Link>, or add them in{" "}
          <Link href="/seo/keywords" className="text-cyan-300 hover:underline">Keywords</Link>. Each one becomes one blog post.
        </div>
      </div>
    );
  }

  const buckets = [
    { key: "idea", label: "To write", tint: "text-slate-300" },
    { key: "drafted", label: "Draft ready — needs your input", tint: "text-amber-300" },
    { key: "published", label: "Published", tint: "text-emerald-300" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="glass-panel p-4 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
          {error}
        </div>
      )}

      {buckets.map((bucket) => {
        const rows = items.filter((i) => i.status === bucket.key);
        if (rows.length === 0) return null;

        return (
          <div key={bucket.key} className="glass-panel p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <h3 className={`text-sm font-semibold ${bucket.tint}`}>{bucket.label}</h3>
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-slate-400">{rows.length}</span>
            </div>

            <div className="flex flex-col gap-2">
              {rows.map((item) => {
                const isOpen = openId === item.id;
                const needsInput = (item.draft_html ?? "").includes(FIRSTHAND_MARKER);

                return (
                  <div key={item.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
                    <div className="flex flex-wrap items-center gap-3 p-3">
                      <Bookmark size={13} className="shrink-0 text-slate-600" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-slate-100">{item.draft_title || item.keyword}</div>
                        <div className="text-[10px] text-slate-500">
                          {item.keyword}
                          {item.volume != null && ` · ${formatNumber(item.volume)}/bln`}
                        </div>
                      </div>

                      {item.status === "idea" && (
                        <button
                          onClick={() => draft(item.id)}
                          disabled={busyId === item.id}
                          className="flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                          style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" }}
                        >
                          <Sparkles size={12} /> {busyId === item.id ? "Menulis…" : "Draft with Claude"}
                        </button>
                      )}

                      {item.status === "drafted" && (
                        <>
                          {needsInput && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-300">
                              <AlertTriangle size={10} /> Butuh pengalaman nyata
                            </span>
                          )}
                          <button
                            onClick={() => setOpenId(isOpen ? null : item.id)}
                            className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-white/[0.1]"
                          >
                            {isOpen ? "Tutup" : "Edit"}
                          </button>
                        </>
                      )}

                      {item.status === "published" && item.published_url && (
                        <a
                          href={item.published_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                        >
                          <ExternalLink size={12} /> Lihat
                        </a>
                      )}
                    </div>

                    {isOpen && item.status === "drafted" && (
                      <div className="border-t border-white/[0.07] p-3 sm:p-4">
                        {needsInput && (
                          <div
                            className="mb-3 flex items-start gap-2 rounded-lg p-3 text-[11px] text-amber-200"
                            style={{ background: "rgba(251,191,36,0.08)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}
                          >
                            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                            <span>
                              Cari <code className="rounded bg-black/30 px-1">{FIRSTHAND_MARKER}]</code> di body, ganti dengan contoh nyata dari toko yang kamu tangani.
                              Publish terkunci sampai bagian itu diisi.
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field label="Judul" value={item.draft_title ?? ""} onChange={(v) => patchItem(item.id, { draft_title: v })} />
                          <Field label="Slug" value={item.draft_slug ?? ""} onChange={(v) => patchItem(item.id, { draft_slug: v })} />
                          <Field label="Meta description" value={item.draft_meta ?? ""} onChange={(v) => patchItem(item.id, { draft_meta: v })} />
                          <Field label="Excerpt" value={item.draft_excerpt ?? ""} onChange={(v) => patchItem(item.id, { draft_excerpt: v })} />
                        </div>

                        <label className="mt-3 block">
                          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Kategori</span>
                          <select
                            value={item.draft_tag ?? "Optimization"}
                            onChange={(e) => patchItem(item.id, { draft_tag: e.target.value })}
                            className="rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 focus:border-cyan-500/50 focus:outline-none"
                          >
                            {TAGS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </label>

                        <label className="mt-3 block">
                          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Body (HTML)</span>
                          <textarea
                            value={item.draft_html ?? ""}
                            onChange={(e) => patchItem(item.id, { draft_html: e.target.value })}
                            rows={18}
                            className="w-full resize-y rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-200 focus:border-cyan-500/50 focus:outline-none"
                          />
                        </label>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => saveDraft(item)}
                            disabled={saving}
                            className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-4 py-2 text-[11px] font-semibold text-slate-300 hover:bg-white/[0.1] disabled:opacity-50"
                          >
                            <Save size={12} /> {saving ? "Menyimpan…" : "Simpan draft"}
                          </button>
                          <button
                            onClick={() => publish(item)}
                            disabled={needsInput || busyId === item.id}
                            title={needsInput ? "Isi bagian pengalaman dulu" : "Publish ke profesoronline.id"}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-4 py-2 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40"
                            style={{ boxShadow: "inset 0 0 0 1px rgba(52,211,153,0.4)" }}
                          >
                            <Send size={12} /> {busyId === item.id ? "Publishing…" : "Publish ke website"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 focus:border-cyan-500/50 focus:outline-none"
      />
    </label>
  );
}
