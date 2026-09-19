"use client";

import { useState } from "react";
import { Filter, Instagram, Facebook, Users, Heart, MessageCircle, TrendingUp } from "lucide-react";

export default function SocialMediaDashboard() {
  const [month, setMonth] = useState("Sep 2026");
  const [platform, setPlatform] = useState("All");
  const [account, setAccount] = useState("All Accounts");

  return (
    <div className="flex h-full flex-col p-8">
      {/* Header & Filters */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Social Media Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Organic performance across Instagram and Facebook.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-3 py-1.5 text-sm text-slate-200">
            <Filter size={14} className="text-cyan-400" />
            <select 
              className="bg-transparent outline-none text-slate-200 cursor-pointer"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="Sep 2026">September 2026</option>
              <option value="Aug 2026">August 2026</option>
              <option value="Jul 2026">July 2026</option>
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-3 py-1.5 text-sm text-slate-200">
            <select 
              className="bg-transparent outline-none text-slate-200 cursor-pointer"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              <option value="All">All Platforms</option>
              <option value="Instagram">Instagram</option>
              <option value="Facebook">Facebook</option>
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-3 py-1.5 text-sm text-slate-200">
            <select 
              className="bg-transparent outline-none text-slate-200 cursor-pointer"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="All Accounts">All Accounts</option>
              <option value="Prof Toko Online">Prof Toko Online</option>
              <option value="Client A">Client A</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Followers", value: "24,592", change: "+4.2%", icon: Users, color: "text-blue-400" },
          { label: "Total Reach", value: "142,881", change: "+12.5%", icon: TrendingUp, color: "text-emerald-400" },
          { label: "Total Engagements", value: "8,204", change: "-1.1%", icon: Heart, color: "text-rose-400" },
          { label: "Comments", value: "1,492", change: "+5.4%", icon: MessageCircle, color: "text-amber-400" },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="rounded-xl border border-white/[0.06] bg-[#0f141e] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-400">{kpi.label}</span>
                <Icon size={16} className={kpi.color} />
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-2xl font-bold text-white">{kpi.value}</span>
                <span className={`text-xs font-semibold ${kpi.change.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {kpi.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Placeholder */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-2 rounded-xl border border-white/[0.06] bg-[#0f141e] p-6 h-[400px] flex items-center justify-center">
          <p className="text-slate-500 flex items-center gap-2">
             <TrendingUp size={16} /> Audience Growth Chart will appear here
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#0f141e] p-6 h-[400px] flex items-center justify-center">
          <p className="text-slate-500 flex items-center gap-2">
             <Facebook size={16} /> <Instagram size={16} /> Platform Split
          </p>
        </div>
      </div>
    </div>
  );
}
