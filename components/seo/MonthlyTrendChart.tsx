"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { compactNumber, formatNumber } from "@/lib/format";

export interface MonthlyRow {
  month: string; // YYYY-MM
  clicks: number;
  impressions: number;
  avgPosition: number;
  ctr: number;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default function MonthlyTrendChart({ data }: { data: MonthlyRow[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-full w-full" />;

  const chartData = data.map((d) => ({ ...d, label: monthLabel(d.month) }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,160,255,0.08)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#7c8bb0", fontSize: 11 }} axisLine={{ stroke: "rgba(120,160,255,0.15)" }} tickLine={false} />
        <YAxis yAxisId="clicks" tick={{ fill: "#7c8bb0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => compactNumber(v as number)} width={44} />
        <YAxis yAxisId="pos" orientation="right" reversed tick={{ fill: "#7c8bb0", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          formatter={(value, name) =>
            name === "avgPosition" ? [Number(value).toFixed(1), "Avg. Position"] : [formatNumber(Number(value) || 0), "Clicks"]
          }
          labelStyle={{ color: "#e5e9f0" }}
          itemStyle={{ color: "#e5e9f0" }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          wrapperStyle={{ fontSize: 12, color: "#9fb0d0", paddingBottom: 8 }}
          formatter={(v) => (v === "avgPosition" ? "Avg. Position" : "Clicks")}
        />
        <Bar yAxisId="clicks" dataKey="clicks" fill="#22d3ee" radius={[4, 4, 0, 0]} barSize={28} />
        <Line yAxisId="pos" type="monotone" dataKey="avgPosition" stroke="#d946ef" strokeWidth={2.5} dot={{ r: 3, fill: "#d946ef" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
