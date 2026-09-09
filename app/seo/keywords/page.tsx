"use client";

import { useEffect, useState } from "react";
import { Bookmark, X, Search, Plus, Globe2 } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { useSeoSite } from "@/components/seo/SeoSiteProvider";

interface SavedKeyword {
  id: string;
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  cpc_usd: number | null;
  position: number | null;
  source: string;
  context: string | null;
  created_at: string;
}

const SOURCE_LABEL: Record<string, string> = {
  research: "Keyword Ideas",
  gap: "Keyword Gap",
  ranked: "Competitor Keywords",
  manual: "Added manually",
};

export default function KeywordsPage() {
  const { sites, selected, selectedSite, loading: loadingSites } = useSeoSite();
  const [keywords, setKeywords] = useState<SavedKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const [newKeyword, setNewKeyword] = useState("");
  const [newVolume, setNewVolume] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    if (!selected) {
      setKeywords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/seo/keywords/saved?siteId=${selected}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setKeywords(j.keywords))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selected]);

  async function remove(id: string) {
    setKeywords((prev) => prev.filter((k) => k.id !== id));
    await fetch(`/api/seo/keywords/saved/${id}`, { method: "DELETE" });
  }

  // Accepts one keyword or a pasted list (newline / comma separated).
  async function addManual() {
    if (!selected) return;
    const terms = newKeyword
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (terms.length === 0) return;

    setAdding(true);
    setAddError("");
    const volume = newVolume.trim() ? parseInt(newVolume.trim(), 10) : undefined;
    const added: SavedKeyword[] = [];

    for (const term of terms) {
      if (keywords.some((k) => k.keyword.toLowerCase() === term.toLowerCase() && k.source === "manual")) continue;
      const res = await fetch("/api/seo/keywords/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: selected,
          keyword: term,
          volume: Number.isFinite(volume) ? volume : undefined,
          source: "manual",
          context: "manual",
        }),
      }).then((r) => r.json());

      if (res.ok) {
        added.push({
          id: res.id,
          keyword: term,
          volume: Number.isFinite(volume) ? volume! : null,
          difficulty: null,
          cpc_usd: null,
          position: null,
          source: "manual",
          context: "manual",
          created_at: new Date().toISOString(),
        });
      } else {
        setAddError(res.error || "Failed to add keyword.");
      }
    }

    if (added.length > 0) {
      setKeywords((prev) => [...added, ...prev]);
      setNewKeyword("");
      setNewVolume("");
    }
    setAdding(false);
  }

  const visible = filter
    ? keywords.filter(
        (k) =>
          k.keyword.toLowerCase().includes(filter.toLowerCase()) ||
          (k.context ?? "").toLowerCase().includes(filter.toLowerCase())
      )
    : keywords;

  if (loadingSites || loading) {
    return <div className="glass-panel p-6 text-center text-xs text-slate-500">Loading saved keywords&hellip;</div>;
  }

  if (sites.length === 0) {
    return (
      <div className="glass-panel p-8 text-center">
        <Globe2 size={28} className="mx-auto mb-3 text-slate-600" />
        <div className="text-sm font-semibold text-slate-300">No websites added yet</div>
        <div className="mt-1 text-xs text-slate-500">Add a website in Manage Websites to start saving keywords for it.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="glass-panel p-4 sm:p-5" style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.25)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Bookmark size={18} className="text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-100">Saved Keywords — {selectedSite?.label}</h2>
            <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">{keywords.length}</span>
          </div>
          <span className="text-[10px] text-slate-500">All keywords you&apos;ve bookmarked from Research &mdash; ready for content briefs and ad targeting.</span>

          {keywords.length > 0 && (
            <div className="relative ml-auto min-w-[200px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter keywords…"
                className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] py-2 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Manual add */}
      <div className="glass-panel p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Plus size={16} className="text-emerald-400" /> Add keywords manually
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Type a keyword, or paste a list separated by commas or new lines to add several at once.
        </p>
        <div className="flex flex-wrap items-start gap-3">
          <textarea
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addManual();
              }
            }}
            rows={1}
            placeholder="jasa kelola toko shopee"
            className="min-w-[240px] flex-1 resize-y rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
          />
          <input
            value={newVolume}
            onChange={(e) => setNewVolume(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Volume (optional)"
            className="w-[150px] rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
          />
          <button
            onClick={addManual}
            disabled={adding || !newKeyword.trim()}
            className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
            style={{ boxShadow: "inset 0 0 0 1px rgba(52,211,153,0.4)" }}
          >
            <Plus size={15} /> {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {addError && <div className="mt-2 text-xs text-rose-300">{addError}</div>}
      </div>

      {keywords.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <Bookmark size={28} className="mx-auto mb-3 text-slate-600" />
          <div className="text-sm font-semibold text-slate-300">No saved keywords yet</div>
          <div className="mt-1 text-xs text-slate-500">
            Add one above, or go to the <span className="text-cyan-300">Research</span> tab and bookmark keywords from keyword ideas or competitor analysis.
          </div>
        </div>
      ) : (
        <div className="glass-panel p-4 sm:p-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Keyword</th>
                  <th className="px-3 py-2.5 font-semibold">Source</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Volume</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Difficulty</th>
                  <th className="px-3 py-2.5 text-right font-semibold">CPC (USD)</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Position</th>
                  <th className="px-3 py-2.5 text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-500">No keywords match &ldquo;{filter}&rdquo;</td>
                  </tr>
                ) : (
                  visible.map((k) => (
                    <tr key={k.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-medium text-slate-100">{k.keyword}</td>
                      <td className="px-3 py-2.5 text-slate-400">
                        {SOURCE_LABEL[k.source] ?? k.source}
                        {k.context && k.source !== "manual" && <span className="text-slate-600"> &middot; {k.context}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{k.volume != null ? formatNumber(k.volume) : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{k.difficulty != null ? k.difficulty : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{k.cpc_usd != null ? `$${k.cpc_usd.toFixed(2)}` : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{k.position != null ? `#${k.position}` : "—"}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => remove(k.id)} className="rounded-md p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300" title="Remove">
                          <X size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
