"use client";

import { useState } from "react";
import { Search, Layers, Check } from "lucide-react";
import type { KeywordMetric } from "@/lib/seo/mock";
import { formatIDR, formatNumber } from "@/lib/format";

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

export default function KeywordResearch({ results }: { results: KeywordMetric[] }) {
  const [query, setQuery] = useState("panasonic ac");

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="glass-panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a seed keyword…"
              className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          <button
            className="flex items-center gap-2 rounded-lg bg-cyan-500/15 px-5 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/25"
            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
          >
            <Search size={15} /> Analyze
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="glass-panel p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-100">Keyword Ideas for &quot;{query}&quot;</h3>
          <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">{results.length} keywords</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5 font-semibold">Keyword</th>
                <th className="px-3 py-2.5 font-semibold">Intent</th>
                <th className="px-3 py-2.5 text-right font-semibold">Volume</th>
                <th className="px-3 py-2.5 text-right font-semibold">Difficulty</th>
                <th className="px-3 py-2.5 text-right font-semibold">CPC</th>
                <th className="px-3 py-2.5 text-center font-semibold">Meta Audience Overlap</th>
              </tr>
            </thead>
            <tbody>
              {results.map((k) => (
                <tr key={k.keyword} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-medium text-slate-100">{k.keyword}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${INTENT_CLS[k.intent]}`}>{k.intent}</span>
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
                  <td className="px-3 py-2.5 text-right text-slate-300">{formatIDR(k.cpcIDR, false)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {k.audienceOverlap ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
                        <Layers size={11} /> Matched
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Check size={12} className="text-cyan-400" />
          &quot;Matched&quot; keywords already align with a saved Meta Ads audience — prime for combined SEO + retargeting plays.
        </p>
      </div>
    </div>
  );
}
