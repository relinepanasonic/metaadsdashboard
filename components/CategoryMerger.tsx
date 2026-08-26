"use client";

import { useEffect, useState } from "react";
import { Merge, Loader2, Search, X, CheckSquare, Square } from "lucide-react";
import { formatNumber } from "@/lib/format";

interface CategoryStat {
  category: string;
  count: number;
}

export default function CategoryMerger({ onMerged }: { onMerged: () => void }) {
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const [search, setSearch] = useState("");
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/audience/category-stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setCategories(j.categories))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(cat: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  async function merge() {
    if (selected.size < 2 || !target.trim()) return;
    setMerging(true);
    setError(null);
    try {
      const res = await fetch("/api/audience/merge-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: Array.from(selected), to: target.trim() }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setToast(`Merged ${json.updated} records into "${json.target}".`);
      setTimeout(() => setToast(null), 3000);
      setSelected(new Set());
      setTarget("");
      load();
      onMerged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMerging(false);
    }
  }

  const filtered = categories.filter((c) => c.category.toLowerCase().includes(search.toLowerCase()));
  const selectedTotal = categories.filter((c) => selected.has(c.category)).reduce((a, c) => a + c.count, 0);

  return (
    <div className="glass-panel p-5">
      <h3 className="mb-1 text-sm font-semibold text-slate-200">Merge Categories</h3>
      <p className="mb-4 text-xs text-slate-500">
        Select every raw category variant that means the same thing (e.g. &quot;d-wash&quot;, &quot;dishwasher&quot;), give it one clean name, and merge.
      </p>

      {toast && (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs text-emerald-300" style={{ boxShadow: "inset 0 0 0 1px rgba(52,211,153,0.3)" }}>
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
          {error}
        </div>
      )}

      <div className="relative mb-3">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter category list…"
          className="w-full rounded-lg border border-white/[0.1] bg-[#0b0e14] py-2 pl-9 pr-8 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            <X size={12} />
          </button>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto rounded-lg border border-white/[0.08]">
        {loading ? (
          <p className="py-8 text-center text-xs text-slate-500">
            <Loader2 size={14} className="mx-auto mb-2 animate-spin" />Loading categories…
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">No categories found.</p>
        ) : (
          filtered.map((c) => {
            const active = selected.has(c.category);
            return (
              <button
                key={c.category}
                type="button"
                onClick={() => toggle(c.category)}
                className={`flex w-full items-center gap-2 border-b border-white/[0.04] px-3 py-2 text-left text-xs last:border-b-0 ${
                  active ? "bg-cyan-500/10" : "hover:bg-white/[0.03]"
                }`}
              >
                {active ? <CheckSquare size={14} className="shrink-0 text-cyan-400" /> : <Square size={14} className="shrink-0 text-slate-600" />}
                <span className={active ? "text-cyan-200" : "text-slate-300"}>{c.category}</span>
                <span className="ml-auto text-slate-500">{formatNumber(c.count)} records</span>
              </button>
            );
          })
        )}
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-white/[0.03] p-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-500">
              Merge {selected.size} categories ({formatNumber(selectedTotal)} records) into:
            </label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g. Dishwasher"
              className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          <button
            onClick={merge}
            disabled={merging || selected.size < 2 || !target.trim()}
            className="flex items-center gap-2 rounded-lg bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
          >
            {merging ? <Loader2 size={13} className="animate-spin" /> : <Merge size={13} />}
            Merge
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-lg bg-white/[0.05] px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.1]"
          >
            Clear
          </button>
        </div>
      )}
      {selected.size === 1 && (
        <p className="mt-2 text-[11px] text-amber-400">Select at least 2 categories to merge.</p>
      )}
    </div>
  );
}
