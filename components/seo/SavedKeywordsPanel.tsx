"use client";

import { Bookmark, X } from "lucide-react";
import { formatNumber } from "@/lib/format";

export interface SavedKeyword {
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
  ranked: "Ranked Keywords",
};

export default function SavedKeywordsPanel({ keywords, onRemove }: { keywords: SavedKeyword[]; onRemove: (id: string) => void }) {
  if (keywords.length === 0) return null;

  return (
    <div className="glass-panel p-4 sm:p-5" style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.25)" }}>
      <div className="mb-3 flex items-center gap-2">
        <Bookmark size={16} className="text-cyan-400" />
        <h3 className="text-sm font-semibold text-slate-100">Saved Keywords</h3>
        <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">{keywords.length}</span>
        <span className="text-[10px] text-slate-500">· for your next action (content briefs, ad targeting, etc.)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 font-semibold">Keyword</th>
              <th className="px-3 py-2 font-semibold">Source</th>
              <th className="px-3 py-2 text-right font-semibold">Volume</th>
              <th className="px-3 py-2 text-right font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((k) => (
              <tr key={k.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                <td className="px-3 py-2 font-medium text-slate-100">{k.keyword}</td>
                <td className="px-3 py-2 text-slate-400">
                  {SOURCE_LABEL[k.source] ?? k.source}
                  {k.context && <span className="text-slate-600"> · {k.context}</span>}
                </td>
                <td className="px-3 py-2 text-right text-slate-300">{k.volume != null ? formatNumber(k.volume) : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => onRemove(k.id)} className="rounded-md p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300" title="Remove">
                    <X size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
