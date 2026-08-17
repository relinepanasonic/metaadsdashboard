"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Share2,
  Globe,
  Megaphone,
  Users,
  Settings,
  ChevronLeft,
  Activity,
  Plug,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

const NAV: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Meta Ads", href: "/meta-ads", icon: Share2, badge: "Live" },
  { label: "Google Ads", href: "/google-ads", icon: Globe, badge: "Soon" },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Leads", href: "/leads", icon: Users },
];

const BOTTOM_NAV: NavItem[] = [
  { label: "Connections", href: "/connections", icon: Plug },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const renderItem = (item: NavItem) => {
    const active = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
          active
            ? "bg-cyan-500/10 text-cyan-300"
            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
        }`}
        style={active ? { boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.3)" } : undefined}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
            style={{ background: "#22d3ee", boxShadow: "0 0 8px #22d3ee" }}
          />
        )}
        <Icon size={18} className="shrink-0" style={active ? { color: "#22d3ee" } : undefined} />
        {!collapsed && (
          <>
            <span className="flex-1 font-medium">{item.label}</span>
            {item.badge && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  item.badge === "Live"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}
              >
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={`sticky top-0 z-20 flex h-screen flex-col border-r border-white/[0.06] bg-[#0b0e14]/80 backdrop-blur-xl transition-all duration-300 ${
        collapsed ? "w-[68px]" : "w-[240px]"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={{ background: "rgba(59,130,246,0.12)", boxShadow: "0 0 0 1px rgba(59,130,246,0.4)" }}
        >
          <Activity size={18} className="text-cyan-400" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-white">Ads Engine</div>
            <div className="truncate text-[10px] text-slate-500">Prof Toko Online</div>
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {!collapsed && (
          <span className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Analytics
          </span>
        )}
        {NAV.map(renderItem)}

        <div className="mt-auto flex flex-col gap-1 pt-4">
          {!collapsed && (
            <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              System
            </span>
          )}
          {BOTTOM_NAV.map(renderItem)}
        </div>
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-3 text-xs text-slate-500 hover:text-slate-300"
      >
        <ChevronLeft size={16} className={`transition-transform ${collapsed ? "rotate-180" : ""}`} />
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}
