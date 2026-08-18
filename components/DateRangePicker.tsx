"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronDown } from "lucide-react";

export interface DateRangeValue {
  preset?: string; // Meta date_preset
  since?: string; // YYYY-MM-DD
  until?: string;
}

const PRESETS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_14d", label: "Last 14 days" },
  { value: "last_28d", label: "Last 28 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "last_90d", label: "Last 90 days" },
  { value: "this_week_mon_today", label: "This week" },
  { value: "last_week_mon_sun", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "last_quarter", label: "Last quarter" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
  { value: "maximum", label: "Maximum (all time)" },
];

export function presetLabel(value: DateRangeValue): string {
  if (value.since && value.until) return `${value.since} → ${value.until}`;
  return PRESETS.find((p) => p.value === value.preset)?.label ?? "Last 30 days";
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  className?: string;
}

export default function DateRangePicker({ value, onChange, className = "" }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const [customSince, setCustomSince] = useState(value.since ?? "");
  const [customUntil, setCustomUntil] = useState(value.until ?? "");
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  function openPanel() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 4, left: r.left });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function pickPreset(preset: string) {
    onChange({ preset });
    setOpen(false);
  }

  function applyCustom() {
    if (customSince && customUntil) {
      onChange({ since: customSince, until: customUntil });
      setOpen(false);
    }
  }

  const isCustom = Boolean(value.since && value.until);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={`flex items-center gap-2 rounded-lg border ${
          open ? "border-cyan-500/50" : "border-white/[0.12]"
        } bg-[#0b0e14] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-white/[0.25]`}
      >
        <Calendar size={13} className="text-slate-500" />
        <span className="whitespace-nowrap">{presetLabel(value)}</span>
        <ChevronDown size={13} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        mounted &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[9999] flex w-[520px] overflow-hidden rounded-lg border border-white/[0.12] shadow-2xl"
            style={{
              top: rect.top,
              left: rect.left,
              background: "#11151f",
              boxShadow: "0 12px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(120,160,255,0.1)",
            }}
          >
            <div className="max-h-80 w-[190px] overflow-y-auto border-r border-white/[0.08] py-1">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => pickPreset(p.value)}
                  className={`block w-full px-3 py-1.5 text-left text-xs transition-colors ${
                    !isCustom && value.preset === p.value
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex-1 p-4">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Custom range</div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-[10px] text-slate-500">Since</label>
                  <input
                    type="date"
                    value={customSince}
                    onChange={(e) => setCustomSince(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 focus:border-cyan-500/50 focus:outline-none"
                    style={{ colorScheme: "dark" }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-slate-500">Until</label>
                  <input
                    type="date"
                    value={customUntil}
                    onChange={(e) => setCustomUntil(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 focus:border-cyan-500/50 focus:outline-none"
                    style={{ colorScheme: "dark" }}
                  />
                </div>
                <button
                  onClick={applyCustom}
                  disabled={!customSince || !customUntil}
                  className="rounded-lg bg-cyan-500/15 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
                >
                  Apply
                </button>
                <p className="text-[10px] text-slate-600">Dates are in the ad account&apos;s reporting timezone.</p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
