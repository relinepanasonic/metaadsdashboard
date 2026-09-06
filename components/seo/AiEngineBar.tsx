"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from "recharts";
import type { AiEngineStat } from "@/lib/seo/mock";

export default function AiEngineBar({ data }: { data: AiEngineStat[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-full w-full" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,160,255,0.08)" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#7c8bb0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="engine" tick={{ fill: "#9fb0d0", fontSize: 11 }} axisLine={false} tickLine={false} width={150} />
        <Tooltip cursor={{ fill: "rgba(120,160,255,0.06)" }} formatter={(value) => [`${Number(value)}%`, "Visibility"]} />
        <Bar dataKey="visibility" radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((d) => (
            <Cell key={d.engine} fill={d.color} />
          ))}
          <LabelList dataKey="visibility" position="right" formatter={(v) => `${Number(v) || 0}%`} style={{ fill: "#cbd5e1", fontSize: 11, fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
