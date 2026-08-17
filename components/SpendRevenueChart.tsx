"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { TimeseriesPoint } from "@/lib/services/types";
import { compactNumber, formatIDR, formatNumber } from "@/lib/format";

// Spend (IDR, left axis) vs Leads (count, right axis).
export default function SpendRevenueChart({ data }: { data: TimeseriesPoint[] }) {
  const trimmed = data.map((d) => ({ ...d, label: d.date.slice(5) }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={trimmed} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d946ef" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#d946ef" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,160,255,0.08)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#7c8bb0", fontSize: 11 }}
          axisLine={{ stroke: "rgba(120,160,255,0.15)" }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          yAxisId="spend"
          tick={{ fill: "#7c8bb0", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => compactNumber(v as number)}
          width={48}
        />
        <YAxis
          yAxisId="leads"
          orientation="right"
          tick={{ fill: "#7c8bb0", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          formatter={(value, name) =>
            name === "spend"
              ? [formatIDR(Number(value) || 0, false), "Ad Spend"]
              : [formatNumber(Number(value) || 0), "Leads"]
          }
          labelStyle={{ color: "#e5e9f0" }}
          itemStyle={{ color: "#e5e9f0" }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          wrapperStyle={{ fontSize: 12, color: "#9fb0d0", paddingBottom: 8 }}
          formatter={(v) => (v === "spend" ? "Ad Spend" : "Leads")}
        />
        <Area
          yAxisId="spend"
          type="monotone"
          dataKey="spend"
          stroke="#d946ef"
          strokeWidth={2.5}
          fill="url(#spendFill)"
          dot={false}
          activeDot={{ r: 5, fill: "#d946ef", stroke: "#0b0e14", strokeWidth: 2 }}
        />
        <Line
          yAxisId="leads"
          type="monotone"
          dataKey="leads"
          stroke="#22d3ee"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: "#22d3ee", stroke: "#0b0e14", strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
