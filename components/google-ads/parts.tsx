"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactNumber, formatNumber } from "@/lib/format";
import type { Totals } from "@/lib/services/googleAdsStats";

// ---------------------------------------------------------------- metrics --

export const ctr = (t: Totals) => (t.impressions > 0 ? t.clicks / t.impressions : 0);
export const cpc = (t: Totals) => (t.clicks > 0 ? t.cost / t.clicks : 0);
export const cpa = (t: Totals) => (t.conversions > 0 ? t.cost / t.conversions : 0);
export const roas = (t: Totals) => (t.cost > 0 ? t.convValue / t.cost : 0);
export const convRate = (t: Totals) => (t.clicks > 0 ? t.conversions / t.clicks : 0);

export function makeMoney(currency: string) {
  const prefix = currency === "IDR" ? "Rp " : currency ? `${currency} ` : "";
  return (n: number, compact = true) => prefix + (compact ? compactNumber(n) : Math.round(n).toLocaleString("en-US"));
}

export const pct = (f: number, dp = 1) => `${(f * 100).toFixed(dp)}%`;
export const dec = (n: number, dp = 1) => (Number.isFinite(n) ? n.toFixed(dp) : "0");

// Human label for Google's enum values: "PERFORMANCE_MAX" -> "Performance Max".
export function label(v: string): string {
  if (!v) return "—";
  return v
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ------------------------------------------------------------------ badges --

const STATUS_STYLE: Record<string, string> = {
  ENABLED: "bg-emerald-500/15 text-emerald-300",
  PAUSED: "bg-slate-500/20 text-slate-400",
  REMOVED: "bg-rose-500/15 text-rose-300",
  ADDED: "bg-emerald-500/15 text-emerald-300",
  EXCLUDED: "bg-rose-500/15 text-rose-300",
  NONE: "bg-slate-500/20 text-slate-400",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[status] ?? "bg-slate-500/20 text-slate-400"}`}>
      {label(status)}
    </span>
  );
}

export function QsBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-600">—</span>;
  const cls = score >= 7 ? "bg-emerald-500/15 text-emerald-300" : score >= 5 ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300";
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${cls}`}>{score}/10</span>;
}

// -------------------------------------------------------------- data table --

export interface Col<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
  sort?: (row: T) => number | string;
  className?: string;
}

export function DataTable<T>({
  rows,
  cols,
  defaultSort,
  rowKey,
  empty = "Nothing to show yet.",
  pageSize = 25,
  minWidth = 720,
}: {
  rows: T[];
  cols: Col<T>[];
  defaultSort: string;
  rowKey: (row: T) => string;
  empty?: string;
  pageSize?: number;
  minWidth?: number;
}) {
  const [sortKey, setSortKey] = useState(defaultSort);
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [shown, setShown] = useState(pageSize);

  useEffect(() => setShown(pageSize), [rows, pageSize]);

  const sorted = useMemo(() => {
    const col = cols.find((c) => c.key === sortKey);
    if (!col?.sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return dir === "desc" ? -c : c;
    });
  }, [rows, cols, sortKey, dir]);

  if (rows.length === 0) return <div className="py-8 text-center text-xs text-slate-500">{empty}</div>;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs" style={{ minWidth }}>
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500">
              {cols.map((c) => {
                const active = sortKey === c.key;
                return (
                  <th key={c.key} className={`px-3 py-2.5 font-semibold ${c.align === "right" ? "text-right" : "text-left"}`}>
                    {c.sort ? (
                      <button
                        onClick={() => {
                          if (active) setDir((d) => (d === "desc" ? "asc" : "desc"));
                          else {
                            setSortKey(c.key);
                            setDir("desc");
                          }
                        }}
                        className={`inline-flex items-center gap-1 hover:text-slate-200 ${active ? "text-slate-200" : ""}`}
                      >
                        {c.label}
                        {active ? dir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} /> : <ArrowUpDown size={11} className="opacity-40" />}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, shown).map((r) => (
              <tr key={rowKey(r)} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                {cols.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 ${c.align === "right" ? "text-right tabular-nums text-slate-300" : "text-left text-slate-200"} ${c.className ?? ""}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > shown && (
        <button onClick={() => setShown((s) => s + pageSize)} className="mx-auto mt-3 block rounded-lg px-4 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10">
          Show {Math.min(pageSize, sorted.length - shown)} more · {sorted.length - shown} remaining
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ charts --

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

const AXIS = { fill: "#7c8bb0", fontSize: 11 };

export function TrendChart({ data, money }: { data: { date: string; cost: number; conversions: number }[]; money: (n: number, c?: boolean) => string }) {
  const mounted = useMounted();
  if (!mounted) return null;
  const rows = data.map((d) => ({ ...d, label: d.date.slice(5) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gadsCost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,160,255,0.08)" vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: "rgba(120,160,255,0.15)" }} tickLine={false} minTickGap={24} />
        <YAxis yAxisId="cost" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => compactNumber(v as number)} width={52} />
        <YAxis yAxisId="conv" orientation="right" tick={AXIS} axisLine={false} tickLine={false} width={34} />
        <Tooltip
          formatter={(v, name) => (name === "cost" ? [money(Number(v) || 0, false), "Spend"] : [dec(Number(v) || 0, 1), "Conversions"])}
          labelStyle={{ color: "#e5e9f0" }}
          itemStyle={{ color: "#e5e9f0" }}
          contentStyle={{ background: "#0b0e14", border: "1px solid rgba(120,160,255,0.2)", borderRadius: 8 }}
        />
        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, color: "#9fb0d0", paddingBottom: 8 }} formatter={(v) => (v === "cost" ? "Spend" : "Conversions")} />
        <Area yAxisId="cost" type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gadsCost)" dot={false} />
        <Line yAxisId="conv" type="monotone" dataKey="conversions" stroke="#22d3ee" strokeWidth={2.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Two-series column chart (spend + conversions) for hour-of-day and weekday views.
export function ColumnChart({
  data,
  money,
}: {
  data: { label: string; cost: number; conversions: number }[];
  money: (n: number, c?: boolean) => string;
}) {
  const mounted = useMounted();
  if (!mounted) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,160,255,0.08)" vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: "rgba(120,160,255,0.15)" }} tickLine={false} interval={0} />
        <YAxis yAxisId="cost" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => compactNumber(v as number)} width={52} />
        <YAxis yAxisId="conv" orientation="right" tick={AXIS} axisLine={false} tickLine={false} width={34} />
        <Tooltip
          formatter={(v, name) => (name === "cost" ? [money(Number(v) || 0, false), "Spend"] : [dec(Number(v) || 0, 1), "Conversions"])}
          labelStyle={{ color: "#e5e9f0" }}
          itemStyle={{ color: "#e5e9f0" }}
          contentStyle={{ background: "#0b0e14", border: "1px solid rgba(120,160,255,0.2)", borderRadius: 8 }}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, color: "#9fb0d0", paddingBottom: 8 }} formatter={(v) => (v === "cost" ? "Spend" : "Conversions")} />
        <Bar yAxisId="cost" dataKey="cost" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="conv" dataKey="conversions" fill="#22d3ee" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Horizontal share bars: label, spend share, conversions and CPA.
export function ShareBars({
  rows,
  money,
  colorOf,
}: {
  rows: (Totals & { key: string })[];
  money: (n: number, c?: boolean) => string;
  colorOf?: (i: number) => string;
}) {
  const total = rows.reduce((a, r) => a + r.cost, 0);
  const palette = ["#3b82f6", "#22d3ee", "#8b5cf6", "#d946ef", "#34d399", "#fbbf24", "#fb7185"];
  if (rows.length === 0 || total === 0) return <div className="py-6 text-center text-xs text-slate-500">No data for this period.</div>;
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => {
        const share = r.cost / total;
        return (
          <div key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-slate-200">{label(r.key)}</span>
              <span className="text-slate-500">
                {money(r.cost)} · {pct(share, 0)} · {formatNumber(r.conversions)} conv{r.conversions > 0 ? ` · CPA ${money(cpa(r))}` : ""}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, share * 100)}%`, background: colorOf ? colorOf(i) : palette[i % palette.length] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
