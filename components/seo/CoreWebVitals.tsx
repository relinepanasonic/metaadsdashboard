import { Smartphone, Monitor } from "lucide-react";
import type { CwvMetric } from "@/lib/seo/mock";

function ring(score: number): string {
  if (score >= 90) return "#34d399";
  if (score >= 50) return "#fbbf24";
  return "#fb7185";
}

function ScoreGauge({ label, score, icon: Icon }: { label: string; score: number; icon: typeof Smartphone }) {
  const color = ring(score);
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] p-4">
      <div className="relative grid h-16 w-16 place-items-center">
        <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(120,160,255,0.1)" strokeWidth="3.5" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 97.4} 97.4`} />
        </svg>
        <span className="absolute text-sm font-black" style={{ color }}>{score}</span>
      </div>
      <div>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
          <Icon size={14} className="text-slate-400" /> {label}
        </div>
        <div className="text-[11px] text-slate-500">Performance score</div>
      </div>
    </div>
  );
}

export default function CoreWebVitals({
  metrics,
  performanceScore,
}: {
  metrics: CwvMetric[];
  performanceScore: { mobile: number; desktop: number };
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ScoreGauge label="Mobile" score={performanceScore.mobile} icon={Smartphone} />
        <ScoreGauge label="Desktop" score={performanceScore.desktop} icon={Monitor} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2.5 font-semibold">Metric</th>
              <th className="px-3 py-2.5 text-right font-semibold">Mobile</th>
              <th className="px-3 py-2.5 text-right font-semibold">Desktop</th>
              <th className="px-3 py-2.5 text-right font-semibold">Target</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const mobileGood = m.mobile <= m.goodBelow;
              const deskGood = m.desktop <= m.goodBelow;
              return (
                <tr key={m.label} className="border-t border-white/[0.05]">
                  <td className="px-3 py-2.5 font-medium text-slate-200">{m.label}</td>
                  <td className="px-3 py-2.5 text-right font-semibold" style={{ color: mobileGood ? "#34d399" : "#fb7185" }}>
                    {m.mobile}{m.unit}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold" style={{ color: deskGood ? "#34d399" : "#fb7185" }}>
                    {m.desktop}{m.unit}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-500">≤ {m.goodBelow}{m.unit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
