"use client";

import { useMemo, useState } from "react";
import { Search, Trophy, Sparkles, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import Panel from "@/components/Panel";
import { formatNumber } from "@/lib/format";

interface KeywordIdea {
  keyword: string;
  volume: number;
  difficulty: number;
  cpcUsd: number;
  intent: string;
}

interface SerpResult {
  rank: number;
  url: string;
}

type SortKey = "volume" | "difficulty" | "cpcUsd";
type SortDir = "asc" | "desc";

const INTENTS = ["Transactional", "Commercial", "Informational", "Navigational"];

function kdColor(kd: number): string {
  if (kd < 30) return "#34d399";
  if (kd < 50) return "#22d3ee";
  if (kd < 70) return "#fbbf24";
  return "#fb7185";
}

const INTENT_CLS: Record<string, string> = {
  Transactional: "bg-emerald-500/15 text-emerald-300",
  Commercial: "bg-cyan-500/15 text-cyan-300",
  Informational: "bg-violet-500/15 text-violet-300",
  Navigational: "bg-amber-500/15 text-amber-300",
};

// A "quick win" = real search demand with low competition — the best ROI target.
function isQuickWin(k: KeywordIdea): boolean {
  return k.volume >= 300 && k.difficulty <= 30;
}

export default function RealKeywordResearch({ suggestions = [] }: { suggestions?: string[] }) {
  const [seed, setSeed] = useState("");
  const [query, setQuery] = useState("");
  const [ideas, setIdeas] = useState<KeywordIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [serp, setSerp] = useState<SerpResult[]>([]);
  const [serpKeyword, setSerpKeyword] = useState("");
  const [serpLoading, setSerpLoading] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [intentFilter, setIntentFilter] = useState<string>("All");
  const [tableFilter, setTableFilter] = useState("");

  async function analyze(kw: string) {
    if (!kw.trim()) return;
    setLoading(true);
    setError("");
    setQuery(kw);
    setIntentFilter("All");
    setTableFilter("");
    try {
      const kRes = await fetch(`/api/seo/research/keywords?seed=${encodeURIComponent(kw)}`, { cache: "no-store" }).then((r) => r.json());
      if (kRes.ok) setIdeas(kRes.keywords);
      else setError(kRes.error || "Failed to load keyword ideas.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
    // Also pull the SERP for the seed itself, as a starting point.
    viewSerp(kw);
  }

  async function viewSerp(kw: string) {
    setSerpKeyword(kw);
    setSerpLoading(true);
    try {
      const sRes = await fetch(`/api/seo/research/serp?keyword=${encodeURIComponent(kw)}`, { cache: "no-store" }).then((r) => r.json());
      if (sRes.ok) setSerp(sRes.results);
    } catch {
      // Non-fatal — keyword table still works even if this one SERP call fails.
    } finally {
      setSerpLoading(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const visibleIdeas = useMemo(() => {
    let rows = ideas;
    if (intentFilter !== "All") rows = rows.filter((k) => k.intent === intentFilter);
    if (tableFilter) rows = rows.filter((k) => k.keyword.toLowerCase().includes(tableFilter.toLowerCase()));
    return [...rows].sort((a, b) => (sortDir === "desc" ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
  }, [ideas, intentFilter, tableFilter, sortKey, sortDir]);

  const quickWinCount = useMemo(() => ideas.filter(isQuickWin).length, [ideas]);

  function SortHeader({ label, sk }: { label: string; sk: SortKey }) {
    const active = sortKey === sk;
    return (
      <th className="px-3 py-2.5 text-right font-semibold">
        <button onClick={() => toggleSort(sk)} className="inline-flex items-center gap-1 hover:text-slate-200">
          {label}
          {active ? sortDir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} /> : <ArrowUpDown size={11} className="opacity-40" />}
        </button>
      </th>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="glass-panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyze(seed)}
              placeholder="Enter a seed keyword…"
              className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          <button
            onClick={() => analyze(seed)}
            disabled={loading || !seed.trim()}
            className="flex items-center gap-2 rounded-lg bg-cyan-500/15 px-5 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
          >
            <Search size={15} /> {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Try one of your real queries:</span>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSeed(s);
                  analyze(s);
                }}
                className="rounded-md bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-cyan-500/15 hover:text-cyan-300"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="glass-panel p-4 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
          {error}
        </div>
      )}

      {!query && !loading && !error && (
        <div className="glass-panel p-8 text-center text-xs text-slate-500">
          Type a seed keyword above (or click a suggestion) to pull real search volume, difficulty, and competitor rankings.
        </div>
      )}

      {/* Keyword ideas */}
      {(query || loading) && (
        <div className="glass-panel p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">Keyword Ideas for &quot;{query}&quot;</h3>
            <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
              {visibleIdeas.length} of {ideas.length}
            </span>
            {quickWinCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                <Sparkles size={10} /> {quickWinCount} quick win{quickWinCount === 1 ? "" : "s"}
              </span>
            )}
            <span className="text-[10px] text-slate-500">· real data via DataForSEO</span>

            {/* Intent filter */}
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {["All", ...INTENTS].map((i) => (
                <button
                  key={i}
                  onClick={() => setIntentFilter(i)}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                    intentFilter === i ? "bg-cyan-500/20 text-cyan-300" : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <input
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            placeholder="Filter these results…"
            className="mb-3 w-full max-w-xs rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Keyword</th>
                  <th className="px-3 py-2.5 font-semibold">Intent</th>
                  <SortHeader label="Volume" sk="volume" />
                  <SortHeader label="Difficulty" sk="difficulty" />
                  <SortHeader label="CPC (USD)" sk="cpcUsd" />
                  <th className="px-3 py-2.5 text-right font-semibold">SERP</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">Loading…</td>
                  </tr>
                ) : visibleIdeas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">No results match the current filters.</td>
                  </tr>
                ) : (
                  visibleIdeas.map((k) => (
                    <tr key={k.keyword} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-medium text-slate-100">
                        <div className="flex items-center gap-1.5">
                          {k.keyword}
                          {isQuickWin(k) && (
                            <span title="High volume, low difficulty" className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                              <Sparkles size={9} /> Quick Win
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${INTENT_CLS[k.intent] ?? "bg-white/[0.06] text-slate-300"}`}>
                          {k.intent}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-200">{formatNumber(k.volume)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-1.5 w-8 overflow-hidden rounded-full bg-white/[0.08]">
                            <span className="block h-full rounded-full" style={{ width: `${k.difficulty}%`, background: kdColor(k.difficulty) }} />
                          </span>
                          <span className="font-semibold" style={{ color: kdColor(k.difficulty) }}>{k.difficulty}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-300">${k.cpcUsd.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => viewSerp(k.keyword)}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${
                            serpKeyword === k.keyword ? "bg-cyan-500/20 text-cyan-300" : "bg-white/[0.05] text-slate-400 hover:bg-white/[0.1] hover:text-slate-200"
                          }`}
                        >
                          <ExternalLink size={10} /> View
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

      {/* Competitor SERP */}
      {serpKeyword && (
        <Panel
          title="Competitor SERP — top 10"
          subtitle={`Live Google ranking for &quot;${serpKeyword}&quot;`}
          right={<Trophy size={16} className="text-amber-400" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">#</th>
                  <th className="px-3 py-2.5 font-semibold">URL</th>
                </tr>
              </thead>
              <tbody>
                {serpLoading ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-slate-500">Loading…</td>
                  </tr>
                ) : serp.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-slate-500">No SERP data yet.</td>
                  </tr>
                ) : (
                  serp.map((r) => (
                    <tr key={r.rank} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <span
                          className={`grid h-6 w-6 place-items-center rounded-md text-[11px] font-bold ${
                            r.rank <= 3 ? "bg-cyan-500/15 text-cyan-300" : "bg-white/[0.05] text-slate-400"
                          }`}
                        >
                          {r.rank}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-200">{r.url}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
