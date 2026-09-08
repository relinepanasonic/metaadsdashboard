"use client";

import { Search, Globe2 } from "lucide-react";
import { useSeoSite } from "./SeoSiteProvider";
import CustomSelect from "@/components/CustomSelect";

export default function SeoHeader() {
  const { sites, selected, setSelected, loading } = useSeoSite();

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
        style={{ background: "rgba(34,211,238,0.12)", boxShadow: "0 0 0 1px rgba(34,211,238,0.4)" }}
      >
        <Search size={22} className="text-cyan-400" />
      </span>
      <div className="min-w-0">
        <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
          SEO <span className="neon-text-cyan">#1</span>
        </h1>
        <p className="text-xs text-slate-500">Organic search + Generative Engine Optimization, wired to your paid Meta data</p>
      </div>

      {!loading && sites.length > 0 && (
        <div className="ml-auto flex items-center gap-1.5">
          <Globe2 size={14} className="shrink-0 text-slate-500" />
          <CustomSelect
            className="min-w-[180px]"
            value={selected}
            onChange={setSelected}
            options={sites.map((s) => ({ value: s.id, label: s.label }))}
          />
        </div>
      )}
    </div>
  );
}
