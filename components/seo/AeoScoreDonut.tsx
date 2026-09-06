"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

function scoreColor(score: number): string {
  if (score >= 70) return "#34d399";
  if (score >= 45) return "#22d3ee";
  if (score >= 25) return "#fbbf24";
  return "#fb7185";
}

export default function AeoScoreDonut({ score }: { score: number }) {
  const color = scoreColor(score);
  const data = [{ name: "AEO", value: score, fill: color }];

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-full w-full" />;

  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="70%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: "rgba(120,160,255,0.08)" }} dataKey="value" cornerRadius={12} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black" style={{ color, textShadow: `0 0 22px ${color}66` }}>{score}</span>
        <span className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">AEO Score</span>
        <span className="text-[10px] text-slate-500">of tracked prompts</span>
      </div>
    </div>
  );
}
