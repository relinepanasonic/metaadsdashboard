"use client";

import Link from "next/link";
import { Search, Settings2, Building2 } from "lucide-react";
import { useSeoSite } from "./SeoSiteProvider";

// The brand (client) is chosen in the sidebar workspace switcher, and the website in the tab bar
// below, so this header only carries the title.
export default function SeoHeader() {
  const { loading, isClient, clientName } = useSeoSite();

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

      {!loading && isClient && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Building2 size={14} className="shrink-0 text-slate-500" />
          <span className="rounded-lg bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200">{clientName || "Your brand"}</span>
        </div>
      )}

      {!loading && !isClient && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
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
