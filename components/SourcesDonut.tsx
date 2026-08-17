"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import type { SourceSlice } from "@/lib/services/types";
import { formatIDR, formatPct } from "@/lib/format";

const COLORS: Record<string, string> = {
  meta: "#22d3ee",
  google: "#d946ef",
};

export default function SourcesDonut({ data }: { data: SourceSlice[] }) {
  const total = data.reduce((a, s) => a + s.spend, 0);

  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            <filter id="donutGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <Pie
            data={data}
            dataKey="spend"
            nameKey="label"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={3}
            stroke="none"
            filter="url(#donutGlow)"
          >
            {data.map((s) => (
              <Cell key={s.platform} fill={COLORS[s.platform]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, item) => {
              const v = Number(value) || 0;
              const slice = (item?.payload ?? {}) as Partial<SourceSlice>;
              return [`${formatIDR(v, false)} (${formatPct(v / total)})`, slice.label ?? ""];
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">Total Spend</span>
        <span className="neon-text-cyan text-lg font-black">{formatIDR(total)}</span>
      </div>

      {/* Legend */}
      <div className="mt-1 flex items-center justify-center gap-4">
        {data.map((s) => (
          <div key={s.platform} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[s.platform] }} />
            <span className="text-xs text-slate-300">
              {s.label} <span className="text-slate-500">{formatPct(s.spend / total, 0)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
