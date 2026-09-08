"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatNumber } from "@/lib/format";

interface IndexingHealthProps {
  indexed: number;
  discoveredNotIndexed: number;
  errors404: number;
  crawlErrors: number;
}

const COLORS = ["#34d399", "#fbbf24", "#fb7185", "#f97316"];

export default function IndexingHealth({ indexed, discoveredNotIndexed, errors404, crawlErrors }: IndexingHealthProps) {
  const data = [
    { name: "Indexed", value: indexed },
    { name: "Discovered · not indexed", value: discoveredNotIndexed },
    { name: "404 errors", value: errors404 },
    { name: "Crawl errors", value: crawlErrors },
  ];
  const total = data.reduce((a, d) => a + d.value, 0);
  const healthPct = total > 0 ? Math.round((indexed / total) * 100) : null;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-full w-full" />;

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-[150px] flex-1">
        {total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="90%" paddingAngle={2} stroke="none">
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [formatNumber(Number(value) || 0), name as string]} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-center text-xs text-slate-500">
            No sitemap data yet.<br />Submit a sitemap in Search Console.
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {healthPct !== null && (
            <>
              <span className="text-2xl font-black text-emerald-400" style={{ textShadow: "0 0 16px rgba(52,211,153,0.4)" }}>{healthPct}%</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">healthy</span>
            </>
          )}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[i] }} />
            <span className="truncate text-slate-400" title={d.name}>{d.name}</span>
            <span className="ml-auto font-semibold text-slate-200">{formatNumber(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
