"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import type { SourceSlice } from "@/lib/services/types";
import { formatIDR, formatPct } from "@/lib/format";

// Palette cycles by slice index so it works for platform-split OR campaign-split.
const PALETTE = ["#22d3ee", "#d946ef", "#8b5cf6", "#3b82f6", "#34d399", "#fbbf24"];

export default function SourcesDonut({ data }: { data: SourceSlice[] }) {
  const total = data.reduce((a, s) => a + s.spend, 0);
  const colorAt = (i: number) => PALETTE[i % PALETTE.length];

  return (
    <div className="flex h-full flex-col">
      {/* Ring — guaranteed minimum height so flex-basis:0 from ancestors can't collapse it */}
      <div className="relative min-h-[160px] flex-1">
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
              {data.map((s, i) => (
                <Cell key={s.label} fill={colorAt(i)} />
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
      </div>

      {/* Legend — its own row, never overlaps the ring */}
      <div className="mt-2 flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1">
        {data.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorAt(i) }} />
            <span className="max-w-[130px] truncate text-xs text-slate-300" title={s.label}>
              {s.label} <span className="text-slate-500">{formatPct(s.spend / total, 0)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
