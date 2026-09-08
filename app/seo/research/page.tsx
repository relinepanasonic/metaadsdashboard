"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plug } from "lucide-react";
import RealQueryTable from "@/components/seo/RealQueryTable";
import RealKeywordResearch from "@/components/seo/RealKeywordResearch";
import CompetitorAnalysis from "@/components/seo/CompetitorAnalysis";
import { useSeoSite } from "@/components/seo/SeoSiteProvider";
import type { QueryRow } from "@/lib/services/searchConsole";

interface SavedKw {
  id: string;
  keyword: string;
  source: string;
  context: string | null;
}

export default function ResearchPage() {
  const { sites, selected, loading: loadingSites } = useSeoSite();
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [filter, setFilter] = useState("");
  const [dfConfigured, setDfConfigured] = useState<boolean | null>(null);

  const [savedKeywords, setSavedKeywords] = useState<SavedKw[]>([]);

  useEffect(() => {
    fetch("/api/seo/keywords/saved", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setSavedKeywords(j.keywords))
      .catch(() => {});
  }, []);

  function isKeywordSaved(keyword: string, source: string, context: string): boolean {
    return savedKeywords.some((k) => k.keyword === keyword && k.source === source && k.context === context);
  }

  async function saveKeyword(payload: {
    keyword: string;
    volume: number;
    difficulty?: number;
    cpcUsd?: number;
    position?: number;
    source: string;
    context: string;
  }) {
    const res = await fetch("/api/seo/keywords/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());
    if (res.ok) {
      setSavedKeywords((prev) => [
        { id: res.id, keyword: payload.keyword, source: payload.source, context: payload.context },
        ...prev,
      ]);
    }
  }

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

      {/* Search Console queries */}
      {isLive ? (
        loadingData ? (
          <div className="glass-panel p-6 text-center text-xs text-slate-500">Loading Search Console queries&hellip;</div>
        ) : (
          <RealQueryTable rows={queries} filter={filter} onFilterChange={setFilter} />
        )
      ) : null}

      {/* Keyword research + Competitor — DataForSEO */}
      {dfConfigured ? (
        <>
          <RealKeywordResearch suggestions={queries.slice(0, 6).map((q) => q.query)} onSave={saveKeyword} isSaved={isKeywordSaved} />
          <CompetitorAnalysis onSave={saveKeyword} isSaved={isKeywordSaved} />
        </>
      ) : dfConfigured === false ? (
        <div className="glass-panel flex flex-wrap items-center gap-3 p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
          <Plug size={18} className="text-amber-400" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-amber-300">Keyword research requires DataForSEO</div>
            <div className="text-xs text-slate-400">Add your DataForSEO API credentials as environment variables to unlock keyword ideas and competitor analysis.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
