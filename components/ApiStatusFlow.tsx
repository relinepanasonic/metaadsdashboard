"use client";

import { Share2, Globe, Server, Database, Cpu, Wifi } from "lucide-react";

type Status = "online" | "mock" | "offline";

interface Node {
  key: string;
  label: string;
  sublabel: string;
  icon: typeof Server;
  status: Status;
  color: string;
}

const STATUS_COPY: Record<Status, string> = {
  online: "Connected",
  mock: "Mock Data",
  offline: "Not Linked",
};

const STATUS_COLOR: Record<Status, string> = {
  online: "#34d399",
  mock: "#fbbf24",
  offline: "#fb7185",
};

const SOURCES: Node[] = [
  { key: "meta", label: "Meta Graph API", sublabel: "act_1153490826516966", icon: Share2, status: "mock", color: "#22d3ee" },
  { key: "google", label: "Google Ads API", sublabel: "google-ads-api SDK", icon: Globe, status: "mock", color: "#d946ef" },
];

const BACKEND: Node[] = [
  { key: "api", label: "Next.js API", sublabel: "/api/dashboard", icon: Server, status: "online", color: "#3b82f6" },
  { key: "db", label: "Supabase", sublabel: "ProfMetaAds", icon: Database, status: "online", color: "#34d399" },
];

function NodeCard({ node }: { node: Node }) {
  const Icon = node.icon;
  return (
    <div className="glass-panel flex items-center gap-3 px-3.5 py-2.5">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
        style={{ background: "rgba(255,255,255,0.03)", boxShadow: `0 0 0 1px ${node.color}44` }}
      >
        <Icon size={17} style={{ color: node.color }} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-slate-100">{node.label}</div>
        <div className="truncate text-[10px] text-slate-500">{node.sublabel}</div>
      </div>
      <div className="ml-auto flex items-center gap-1.5 pl-2">
        <span
          className="pulse-node h-2 w-2 rounded-full"
          style={{ color: STATUS_COLOR[node.status], background: STATUS_COLOR[node.status] }}
        />
        <span className="text-[10px] font-medium" style={{ color: STATUS_COLOR[node.status] }}>
          {STATUS_COPY[node.status]}
        </span>
      </div>
    </div>
  );
}

export default function ApiStatusFlow() {
  return (
    <div className="glass-panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <Wifi size={15} className="text-cyan-400" />
        <h3 className="text-sm font-semibold text-slate-200">Data Pipeline Status</h3>
        <span className="ml-auto text-[11px] text-slate-500">Frontend → API → Sources</span>
      </div>

      <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        {/* Sources (left) */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Ad Platforms</span>
          {SOURCES.map((n) => (
            <NodeCard key={n.key} node={n} />
          ))}
        </div>

        {/* Central API hub with connector lines */}
        <div className="flex items-center justify-center py-2">
          <svg width="120" height="120" viewBox="0 0 120 120" className="hidden lg:block">
            <line x1="0" y1="35" x2="60" y2="60" stroke="#22d3ee" strokeWidth="1.5" className="flow-line" opacity="0.6" />
            <line x1="0" y1="85" x2="60" y2="60" stroke="#d946ef" strokeWidth="1.5" className="flow-line" opacity="0.6" />
            <line x1="60" y1="60" x2="120" y2="35" stroke="#3b82f6" strokeWidth="1.5" className="flow-line" opacity="0.6" />
            <line x1="60" y1="60" x2="120" y2="85" stroke="#34d399" strokeWidth="1.5" className="flow-line" opacity="0.6" />
            <circle cx="60" cy="60" r="26" fill="rgba(59,130,246,0.12)" stroke="#3b82f6" strokeWidth="1.5" />
          </svg>
          <div className="relative -ml-[76px] hidden lg:block">
            <span
              className="grid h-12 w-12 place-items-center rounded-full"
              style={{ background: "rgba(11,14,20,0.9)", boxShadow: "0 0 24px rgba(59,130,246,0.5), 0 0 0 1px rgba(59,130,246,0.6)" }}
            >
              <Cpu size={20} className="text-blue-400" />
            </span>
          </div>
          {/* Mobile hub */}
          <span
            className="grid h-12 w-12 place-items-center rounded-full lg:hidden"
            style={{ background: "rgba(11,14,20,0.9)", boxShadow: "0 0 24px rgba(59,130,246,0.5), 0 0 0 1px rgba(59,130,246,0.6)" }}
          >
            <Cpu size={20} className="text-blue-400" />
          </span>
        </div>

        {/* Backend (right) */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 lg:text-right">Backend</span>
          {BACKEND.map((n) => (
            <NodeCard key={n.key} node={n} />
          ))}
        </div>
      </div>
    </div>
  );
}
