"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Factory, Link2, Upload } from "lucide-react";
import { useSeoSite } from "./SeoSiteProvider";

// The three parts of the Blog Engine. A client login only sees the Content Engine (published posts).
const SUB_TABS = [
  { href: "/seo/blog/connection", label: "Connection 2 Web", icon: Link2, staffOnly: true },
  { href: "/seo/blog/content", label: "Content Engine", icon: Factory, staffOnly: false },
  { href: "/seo/blog/uploader", label: "Blog Uploader", icon: Upload, staffOnly: true },
];

export default function BlogSubTabs() {
  const pathname = usePathname();
  const { isClient } = useSeoSite();
  const tabs = SUB_TABS.filter((t) => !(isClient && t.staffOnly));

  return (
    <div className="mb-5 flex flex-wrap items-center gap-6 border-b border-white/[0.07]">
      {tabs.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px flex items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-xs font-semibold transition-colors ${
              active ? "border-cyan-400 text-cyan-300" : "border-transparent text-slate-500 hover:text-slate-200"
            }`}
          >
            <Icon size={14} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
