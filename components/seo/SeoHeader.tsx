"use client";

import Link from "next/link";
import { Search, Globe2, Settings2 } from "lucide-react";
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

      {!loading && (
        <div className="ml-auto flex items-center gap-2">
          {sites.length > 0 && (
            <>
              <Globe2 size={14} className="shrink-0 text-slate-500" />
              <CustomSelect
                className="min-w-[200px]"
                value={selected}
                onChange={setSelected}
                options={sites.map((s) => ({ value: s.id, label: s.label }))}
              />
              <span className="hidden text-[10px] text-slate-600 sm:inline">{sites.length} website{sites.length === 1 ? "" : "s"}</span>
            </>
          )}
          <Link
            href="/seo/connect"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.1]"
          >
            <Settings2 size={13} /> Manage Websites
          </Link>
        </div>
      )}
    </div>
  );
}
