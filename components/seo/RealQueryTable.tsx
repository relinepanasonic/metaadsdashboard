"use client";

import { Search } from "lucide-react";
import { formatNumber, formatPct } from "@/lib/format";
import type { QueryRow } from "@/lib/services/searchConsole";

export default function RealQueryTable({
  rows,
  filter,
  onFilterChange,
}: {
  rows: QueryRow[];
  filter: string;
  onFilterChange: (v: string) => void;
}) {
  const filtered = filter ? rows.filter((r) => r.query.toLowerCase().includes(filter.toLowerCase())) : rows;

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Filter your real search queries…"
            className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="glass-panel p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-100">Queries you already rank for</h3>
          <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
            {filtered.length} of {rows.length}
          </span>
          <span className="text-[10px] text-slate-500">· last 90 days, from Search Console</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5 font-semibold">Query</th>
                <th className="px-3 py-2.5 text-right font-semibold">Clicks</th>
                <th className="px-3 py-2.5 text-right font-semibold">Impressions</th>
                <th className="px-3 py-2.5 text-right font-semibold">CTR</th>
                <th className="px-3 py-2.5 text-right font-semibold">Avg. Position</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    No search queries in the last 90 days yet.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    No queries match &quot;{filter}&quot;.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.query} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 font-medium text-slate-100">{r.query}</td>
                    <td className="px-3 py-2.5 text-right text-slate-200">{formatNumber(r.clicks)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{formatNumber(r.impressions)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{formatPct(r.ctr)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{r.position.toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
