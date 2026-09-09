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
  const { sites, selected, selectedSite, loading: loadingSites } = useSeoSite();
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [filter, setFilter] = useState("");
  const [dfConfigured, setDfConfigured] = useState<boolean | null>(null);

  const [savedKeywords, setSavedKeywords] = useState<SavedKw[]>([]);

  useEffect(() => {
    if (!selected) {
      setSavedKeywords([]);
      return;
    }
    fetch(`/api/seo/keywords/saved?siteId=${selected}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setSavedKeywords(j.keywords))
      .catch(() => {});
  }, [selected]);

  function isKeywordSaved(keyword: string, source: string, context: string): boolean {
    return savedKeywords.some((k) => k.keyword === keyword && k.source === source && k.context === context);
  }

  // Toggles a keyword's saved state: saves it if not already saved, removes
  // it if clicked again.
  async function saveKeyword(payload: {
    keyword: string;
    volume: number;
    difficulty?: number;
    cpcUsd?: number;
    position?: number;
    source: string;
    context: string;
  }) {
    if (!selected) return;
    const existing = savedKeywords.find((k) => k.keyword === payload.keyword && k.source === payload.source && k.context === payload.context);

    if (existing) {
      setSavedKeywords((prev) => prev.filter((k) => k.id !== existing.id));
      await fetch(`/api/seo/keywords/saved/${existing.id}`, { method: "DELETE" });
      return;
    }

    const res = await fetch("/api/seo/keywords/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, siteId: selected }),
    }).then((r) => r.json());
    if (res.ok) {
      setSavedKeywords((prev) => [
        { id: res.id, keyword: payload.keyword, source: payload.source, context: payload.context },
        ...prev,
      ]);
    }
  }

  useEffect(() => {
    if (!selected || !selectedSite || selectedSite.status !== "connected") {
      setQueries([]);
      return;
    }
    setLoadingData(true);
    fetch(`/api/seo/gsc/queries?siteId=${selected}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setQueries(j.queries);
      })
      .finally(() => setLoadingData(false));
  }, [selected, selectedSite]);

  useEffect(() => {
    fetch("/api/seo/dataforseo/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setDfConfigured(j.ok ? j.configured : false))
      .catch(() => setDfConfigured(false));
  }, []);

  const hasSites = sites.length > 0;
  const gscLive = selectedSite?.status === "connected";

  return (
    <div className="flex flex-col gap-4">
      {/* No websites at all yet */}
      {!loadingSites && !hasSites && (
        <div className="glass-panel flex flex-wrap items-center gap-3 p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
          <Plug size={18} className="text-amber-400" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-amber-300">No websites added yet</div>
            <div className="text-xs text-slate-400">Add a website — no Search Console needed — to start researching keywords and competitors.</div>
          </div>
          <Link
            href="/seo/connect"
            className="ml-auto flex shrink-0 items-center gap-2 rounded-lg bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
            style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.4)" }}
          >
            Add a Website
          </Link>
        </div>
      )}

      {/* Search Console queries — only when the selected site has GSC connected */}
      {hasSites && !gscLive && (
        <div className="glass-panel flex flex-wrap items-center gap-3 p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(148,163,184,0.15)" }}>
          <Plug size={16} className="text-slate-500" />
          <div className="min-w-0 text-xs text-slate-500">
            Connect Search Console for <strong className="text-slate-300">{selectedSite?.label}</strong> to see the real queries it ranks for.
          </div>
          <Link href="/seo/connect" className="ml-auto shrink-0 text-xs font-semibold text-cyan-300 hover:underline">
            Connect
          </Link>
        </div>
      )}
      {gscLive && (
        loadingData ? (
          <div className="glass-panel p-6 text-center text-xs text-slate-500">Loading Search Console queries&hellip;</div>
        ) : (
          <RealQueryTable rows={queries} filter={filter} onFilterChange={setFilter} />
        )
      )}

      {/* Keyword research + Competitor — DataForSEO, works for any site */}
      {hasSites && selected && dfConfigured ? (
        <>
          <RealKeywordResearch suggestions={queries.slice(0, 6).map((q) => q.query)} onSave={saveKeyword} isSaved={isKeywordSaved} />
          <CompetitorAnalysis onSave={saveKeyword} isSaved={isKeywordSaved} />
        </>
      ) : hasSites && dfConfigured === false ? (
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
