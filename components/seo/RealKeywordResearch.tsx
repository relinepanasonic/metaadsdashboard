"use client";

import { useEffect, useState } from "react";
import { Search, Trophy } from "lucide-react";
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

export default function RealKeywordResearch({ defaultSeed }: { defaultSeed: string }) {
  const [seed, setSeed] = useState(defaultSeed);
  const [query, setQuery] = useState(defaultSeed);
  const [ideas, setIdeas] = useState<KeywordIdea[]>([]);
  const [serp, setSerp] = useState<SerpResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze(kw: string) {
    if (!kw.trim()) return;
    setLoading(true);
    setError("");
    setQuery(kw);
    try {
      const [kRes, sRes] = await Promise.all([
        fetch(`/api/seo/research/keywords?seed=${encodeURIComponent(kw)}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/seo/research/serp?keyword=${encodeURIComponent(kw)}`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (kRes.ok) setIdeas(kRes.keywords);
      else setError(kRes.error || "Failed to load keyword ideas.");
      if (sRes.ok) setSerp(sRes.results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    analyze(defaultSeed);
  }, []);

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
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-cyan-500/15 px-5 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
          >
            <Search size={15} /> {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel p-4 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
          {error}
        </div>
      )}

      {/* Keyword ideas */}
      <div className="glass-panel p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-100">Keyword Ideas for &quot;{query}&quot;</h3>
          <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">{ideas.length} keywords</span>
          <span className="text-[10px] text-slate-500">· real data via DataForSEO</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5 font-semibold">Keyword</th>
                <th className="px-3 py-2.5 font-semibold">Intent</th>
                <th className="px-3 py-2.5 text-right font-semibold">Volume</th>
                <th className="px-3 py-2.5 text-right font-semibold">Difficulty</th>
                <th className="px-3 py-2.5 text-right font-semibold">CPC (USD)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">Loading…</td>
                </tr>
              ) : ideas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">No results yet — try a different seed keyword.</td>
                </tr>
              ) : (
                ideas.map((k) => (
                  <tr key={k.keyword} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 font-medium text-slate-100">{k.keyword}</td>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Competitor SERP */}
      <Panel
        title="Competitor SERP — top 10"
        subtitle={`Live Google ranking for &quot;${query}&quot;`}
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
              {serp.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-slate-500">
                    {loading ? "Loading…" : "No SERP data yet."}
                  </td>
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
    </div>
  );
}
