import type { SerpRow } from "@/lib/seo/mock";

export default function SerpTable({ rows }: { rows: SerpRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2.5 font-semibold">#</th>
            <th className="px-3 py-2.5 font-semibold">URL</th>
            <th className="px-3 py-2.5 text-right font-semibold">Domain Authority</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.rank}
              className={`border-t border-white/[0.05] ${r.isYou ? "bg-cyan-500/[0.06]" : "hover:bg-white/[0.02]"}`}
            >
              <td className="px-3 py-2.5">
                <span className={`grid h-6 w-6 place-items-center rounded-md text-[11px] font-bold ${
                  r.rank <= 3 ? "bg-cyan-500/15 text-cyan-300" : "bg-white/[0.05] text-slate-400"
                }`}>{r.rank}</span>
              </td>
              <td className="px-3 py-2.5">
                <span className="font-medium text-slate-200">{r.url}</span>
                {r.isYou && (
                  <span className="ml-2 rounded-md bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300">You</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-10 overflow-hidden rounded-full bg-white/[0.08]">
                    <span className="block h-full rounded-full bg-violet-400" style={{ width: `${r.da}%` }} />
                  </span>
                  <span className="font-semibold text-slate-300">{r.da}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
