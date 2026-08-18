"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  accent?: boolean; // highlight (e.g. currently-assigned client)
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  allowAddNew?: boolean;
  onAddNew?: (name: string) => void;
  size?: "sm" | "md";
  className?: string;
}

// Fully custom dropdown — dark themed, readable in every browser (native
// <option> elements ignore most CSS and render white-on-white in Chrome/Edge).
export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder = "Select…",
  allowAddNew = false,
  onAddNew,
  size = "md",
  className = "",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);
  const pad = size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-2 text-xs";

  function commitAdd() {
    const name = newName.trim();
    if (name && onAddNew) onAddNew(name);
    setNewName("");
    setAdding(false);
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border ${
          open ? "border-cyan-500/50" : "border-white/[0.12]"
        } bg-[#0b0e14] ${pad} font-semibold ${
          selected?.accent ? "text-cyan-300" : "text-slate-200"
        } transition-colors hover:border-white/[0.25]`}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown size={13} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-64 w-max min-w-full overflow-y-auto rounded-lg border border-white/[0.12] py-1 shadow-2xl"
          style={{ background: "#11151f", boxShadow: "0 12px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(120,160,255,0.08)" }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`block w-full whitespace-nowrap px-3 py-1.5 text-left text-xs transition-colors ${
                o.value === value
                  ? "bg-cyan-500/15 text-cyan-300"
                  : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {o.label}
            </button>
          ))}

          {allowAddNew && (
            <div className="mt-1 border-t border-white/[0.08] pt-1">
              {adding ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && commitAdd()}
                    placeholder="Client name…"
                    className="w-full rounded border border-white/[0.15] bg-[#0b0e14] px-2 py-1 text-xs text-slate-100 focus:border-cyan-500/50 focus:outline-none"
                  />
                  <button onClick={commitAdd} className="rounded bg-cyan-500/20 px-2 py-1 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-500/30">
                    Add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-left text-xs text-slate-400 hover:bg-white/[0.06] hover:text-cyan-300"
                >
                  <Plus size={12} /> Add new…
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
