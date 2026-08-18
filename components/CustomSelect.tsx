"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
// The option panel renders in a portal at document.body so it always floats
// above every panel, regardless of any ancestor's backdrop-filter/z-index
// stacking context.
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
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  function openPanel() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function reposition() {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
      setAdding(false);
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

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
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border ${
          open ? "border-cyan-500/50" : "border-white/[0.12]"
        } bg-[#0b0e14] ${pad} font-semibold ${
          selected?.accent ? "text-cyan-300" : "text-slate-200"
        } transition-colors hover:border-white/[0.25]`}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown size={13} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        mounted &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[9999] max-h-64 w-max min-w-[140px] overflow-y-auto rounded-lg border border-white/[0.12] py-1 shadow-2xl"
            style={{
              top: rect.top,
              left: rect.left,
              minWidth: rect.width,
              background: "#11151f",
              boxShadow: "0 12px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(120,160,255,0.1)",
            }}
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
          </div>,
          document.body
        )}
    </div>
  );
}
