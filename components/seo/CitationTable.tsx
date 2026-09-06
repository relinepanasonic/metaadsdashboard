import { Check, X } from "lucide-react";
import type { Citation } from "@/lib/seo/mock";

export default function CitationTable({ rows }: { rows: Citation[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2.5 font-semibold">Target Prompt</th>
            <th className="px-3 py-2.5 font-semibold">AI Engine</th>
            <th className="px-3 py-2.5 text-center font-semibold">Brand Mentioned?</th>
            <th className="px-3 py-2.5 font-semibold">Competitors Cited</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
              <td className="px-3 py-2.5 font-medium text-slate-100">&quot;{r.prompt}&quot;</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">{r.engine}</td>
              <td className="px-3 py-2.5 text-center">
                {r.mentioned ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    <Check size={11} /> Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                    <X size={11} /> No
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5">
                {r.competitors.length === 0 ? (
                  <span className="text-slate-600">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {r.competitors.map((c) => (
                      <span key={c} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-slate-300">{c}</span>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
