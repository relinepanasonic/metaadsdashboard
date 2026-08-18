"use client";

import { useEffect, useState } from "react";
import { Wallet, MessageCircle, Target, Eye } from "lucide-react";
import type { CampaignTableRow } from "@/lib/services/types";
import { formatIDR, formatNumber } from "@/lib/format";
import KpiCard from "./KpiCard";
import CampaignsTable from "./CampaignsTable";

export default function ClientOverview({ clientName }: { clientName: string }) {
  const [rows, setRows] = useState<CampaignTableRow[] | null>(null);

  useEffect(() => {
    fetch("/api/meta/my-campaigns", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setRows(j.campaigns))
      .catch(() => setRows([]));
  }, []);

  const totals = (rows ?? []).reduce(
    (a, r) => ({
      spend: a.spend + r.spend,
      results: a.results + r.results,
      impressions: a.impressions + r.impressions,
    }),
    { spend: 0, results: 0, impressions: 0 }
  );
  const costPerResult = totals.results > 0 ? Math.round(totals.spend / totals.results) : 0;

  return (
    <div className="relative z-10 mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
          {clientName} <span className="neon-text-cyan">Campaigns</span>
        </h1>
        <p className="mt-1 text-xs text-slate-500">Last 30 days · Meta Ads</p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Spend" value={formatIDR(totals.spend)} icon={Wallet} accent="magenta" />
        <KpiCard label="Results" value={formatNumber(totals.results)} icon={MessageCircle} accent="cyan" />
        <KpiCard label="Cost / Result" value={costPerResult > 0 ? formatIDR(costPerResult, false) : "—"} icon={Target} accent="violet" />
        <KpiCard label="Impressions" value={formatNumber(totals.impressions)} icon={Eye} accent="blue" />
      </div>

      <CampaignsTable mode="client" />
    </div>
  );
}
