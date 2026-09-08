"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Plug, Globe2 } from "lucide-react";
import Panel from "@/components/Panel";
import CustomSelect from "@/components/CustomSelect";
import KeywordResearch from "@/components/seo/KeywordResearch";
import SerpTable from "@/components/seo/SerpTable";
import RealQueryTable from "@/components/seo/RealQueryTable";
import RealKeywordResearch from "@/components/seo/RealKeywordResearch";
import { keywordResults, serpTable } from "@/lib/seo/mock";
import type { QueryRow } from "@/lib/services/searchConsole";

interface SiteConnection {
  id: string;
  site_url: string;
  label: string;
  status: "pending" | "connected" | "error";
}

export default function ResearchPage() {
  const [sites, setSites] = useState<SiteConnection[]>([]);
  const [selected, setSelected] = useState("");
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [filter, setFilter] = useState("");
  const [dfConfigured, setDfConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/seo/gsc/sites", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          const connected = (j.sites as SiteConnection[]).filter((s) => s.status === "connected");
          setSites(connected);
          if (connected[0]) setSelected(connected[0].id);
        }
      })
      .finally(() => setLoadingSites(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoadingData(true);
    fetch(`/api/seo/gsc/queries?siteId=${selected}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setQueries(j.queries);
      })
      .finally(() => setLoadingData(false));
  }, [selected]);

  useEffect(() => {
    fetch("/api/seo/dataforseo/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setDfConfigured(j.ok ? j.configured : false))
      .catch(() => setDfConfigured(false));
  }, []);

  const isLive = sites.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Connection banner */}
      {!loadingSites && !isLive && (
        <div className="glass-panel flex flex-wrap items-center gap-3 p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
          <Plug size={18} className="text-amber-400" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-amber-300">You&apos;re viewing demo data</div>
            <div className="text-xs text-slate-400">Connect your website to Google Search Console to see the real queries you rank for.</div>
          </div>
          <Link
            href="/seo/connect"
            className="ml-auto flex shrink-0 items-center gap-2 rounded-lg bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
            style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.4)" }}
          >
            Connect Now
          </Link>
        </div>
      )}

      {/* Website selector */}
      {isLive && (
        <div className="glass-panel flex flex-wrap items-center gap-3 p-3">
          <div className="flex items-center gap-1.5">
            <Globe2 size={14} className="shrink-0 text-slate-500" />
            <CustomSelect
              className="min-w-[180px]"
              value={selected}
              onChange={setSelected}
              options={sites.map((s) => ({ value: s.id, label: s.label }))}
            />
          </div>
        </div>
      )}

      {isLive ? (
        loadingData ? (
          <div className="glass-panel p-6 text-center text-xs text-slate-500">Loading Search Console queries…</div>
        ) : (
          <RealQueryTable rows={queries} filter={filter} onFilterChange={setFilter} />
        )
      ) : null}

      {/* Keyword research + competitor SERP — DataForSEO */}
      {dfConfigured ? (
        <RealKeywordResearch defaultSeed="panasonic ac" />
      ) : dfConfigured === false ? (
        <>
          <div className="glass-panel flex flex-wrap items-center gap-3 p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
            <Plug size={18} className="text-amber-400" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-amber-300">Keyword research is showing demo data</div>
              <div className="text-xs text-slate-400">Connect a DataForSEO API key to see real search volume, difficulty, and competitor rankings.</div>
            </div>
          </div>
          <KeywordResearch results={keywordResults} />

          <Panel
            title="Competitor SERP — top 10 (demo)"
            subtitle="Current ranking pages for &quot;panasonic ac 1 pk murah&quot;"
            right={<Trophy size={16} className="text-amber-400" />}
          >
            <SerpTable rows={serpTable} />
          </Panel>
        </>
      ) : null}
    </div>
  );
}
