"use client";

import { type LucideIcon } from "lucide-react";

type Accent = "cyan" | "blue" | "magenta" | "violet";

const ACCENTS: Record<Accent, { text: string; glow: string; ring: string }> = {
  cyan: { text: "#22d3ee", glow: "rgba(34,211,238,0.35)", ring: "rgba(34,211,238,0.25)" },
  blue: { text: "#3b82f6", glow: "rgba(59,130,246,0.35)", ring: "rgba(59,130,246,0.25)" },
  magenta: { text: "#d946ef", glow: "rgba(217,70,239,0.35)", ring: "rgba(217,70,239,0.25)" },
  violet: { text: "#8b5cf6", glow: "rgba(139,92,246,0.35)", ring: "rgba(139,92,246,0.25)" },
};

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  icon: LucideIcon;
  accent?: Accent;
}

export default function KpiCard({
  label,
  value,
  delta,
  deltaPositive = true,
  icon: Icon,
  accent = "cyan",
}: KpiCardProps) {
  const a = ACCENTS[accent];
  return (
    <div className="glass-panel glass-panel-hover relative overflow-hidden p-4 sm:p-5">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl"
        style={{ background: a.glow }}
      />
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span
          className="grid h-8 w-8 place-items-center rounded-lg"
          style={{ background: "rgba(255,255,255,0.03)", boxShadow: `0 0 0 1px ${a.ring}` }}
        >
          <Icon size={16} style={{ color: a.text }} />
        </span>
      </div>
      <div
        className="mt-3 text-2xl font-black tracking-tight sm:text-[28px]"
        style={{ color: a.text, textShadow: `0 0 16px ${a.glow}` }}
      >
        {value}
      </div>
      {delta && (
        <div className="mt-1 text-xs font-semibold" style={{ color: deltaPositive ? "#34d399" : "#fb7185" }}>
          {deltaPositive ? "▲" : "▼"} {delta}
          <span className="ml-1 font-normal text-slate-500">vs last 30d</span>
        </div>
      )}
    </div>
  );
}
