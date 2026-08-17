"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import type { CampaignRow } from "@/lib/services/types";
import { compactNumber, formatIDR } from "@/lib/format";

export default function TopCampaignsBar({ data }: { data: CampaignRow[] }) {
  const rows = data.map((c) => ({
    ...c,
    short: c.name.length > 22 ? c.name.slice(0, 20) + "…" : c.name,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="barMeta" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="barGoogle" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#d946ef" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,160,255,0.08)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "#7c8bb0", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => compactNumber(v as number)}
        />
        <YAxis
          type="category"
          dataKey="short"
          tick={{ fill: "#9fb0d0", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip
          cursor={{ fill: "rgba(120,160,255,0.06)" }}
          formatter={(value) => [formatIDR(Number(value) || 0, false), "Spend"]}
        />
        <Bar dataKey="spend" radius={[0, 6, 6, 0]} barSize={16}>
          {rows.map((r) => (
            <Cell key={r.id} fill={r.platform === "meta" ? "url(#barMeta)" : "url(#barGoogle)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
