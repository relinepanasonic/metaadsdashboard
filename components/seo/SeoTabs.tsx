"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, SearchCode, Factory, Sparkles, Wrench, Bookmark } from "lucide-react";

const TABS = [
  { href: "/seo", label: "Dashboard", icon: LayoutDashboard },
  { href: "/seo/research", label: "Research", icon: SearchCode },
  { href: "/seo/keywords", label: "Keywords", icon: Bookmark },
  { href: "/seo/content", label: "Content Engine", icon: Factory },
  { href: "/seo/geo", label: "GEO & AI Visibility", icon: Sparkles },
  { href: "/seo/technical", label: "Technical & Indexing", icon: Wrench },
];

export default function SeoTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.06] bg-[#0b0e14]/60 p-1.5">
      {TABS.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              active
                ? "bg-cyan-500/15 text-cyan-300"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
            style={active ? { boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" } : undefined}
          >
            <Icon size={14} style={active ? { color: "#22d3ee" } : undefined} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
