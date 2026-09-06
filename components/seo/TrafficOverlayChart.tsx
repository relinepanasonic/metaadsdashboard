"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { TrafficPoint } from "@/lib/seo/mock";
import { compactNumber, formatNumber } from "@/lib/format";

export default function TrafficOverlayChart({ data }: { data: TrafficPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="organicFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="paidFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d946ef" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#d946ef" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,160,255,0.08)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#7c8bb0", fontSize: 11 }}
          axisLine={{ stroke: "rgba(120,160,255,0.15)" }}
          tickLine={false}
          minTickGap={28}
        />
        <YAxis
          tick={{ fill: "#7c8bb0", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => compactNumber(v as number)}
          width={44}
        />
        <Tooltip
          formatter={(value, name) => [formatNumber(Number(value) || 0), name === "organic" ? "Organic (SEO)" : "Paid (Meta)"]}
          labelStyle={{ color: "#e5e9f0" }}
          itemStyle={{ color: "#e5e9f0" }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          wrapperStyle={{ fontSize: 12, color: "#9fb0d0", paddingBottom: 8 }}
          formatter={(v) => (v === "organic" ? "Organic (SEO)" : "Paid (Meta)")}
        />
        <Area type="monotone" dataKey="paid" stroke="#d946ef" strokeWidth={2.5} fill="url(#paidFill)" dot={false}
          activeDot={{ r: 5, fill: "#d946ef", stroke: "#0b0e14", strokeWidth: 2 }} />
        <Area type="monotone" dataKey="organic" stroke="#22d3ee" strokeWidth={2.5} fill="url(#organicFill)" dot={false}
          activeDot={{ r: 5, fill: "#22d3ee", stroke: "#0b0e14", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
