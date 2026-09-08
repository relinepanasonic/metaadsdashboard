"use client";

import { useState } from "react";
import { Users, Target, Swords, ArrowRight } from "lucide-react";
import { formatNumber } from "@/lib/format";

interface CompetitorDomain {
  domain: string;
  avgPosition: number;
  intersections: number;
  organicKeywords: number;
  organicTrafficEst: number;
}

interface DomainOverview {
  domain: string;
  organicKeywords: number;
  organicTrafficEst: number;
}

interface GapKeyword {
  keyword: string;
  volume: number;
  competitorPosition: number;
}

export default function CompetitorAnalysis({ yourDomain }: { yourDomain: string }) {
  const [domainInput, setDomainInput] = useState(yourDomain);
  const [competitors, setCompetitors] = useState<CompetitorDomain[]>([]);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const [competitorsError, setCompetitorsError] = useState("");
  const [searchedDomain, setSearchedDomain] = useState("");

  const [manualCompetitor, setManualCompetitor] = useState("");
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [yourOverview, setYourOverview] = useState<DomainOverview | null>(null);
  const [competitorOverview, setCompetitorOverview] = useState<DomainOverview | null>(null);
  const [gap, setGap] = useState<GapKeyword[]>([]);
  const [activeCompetitor, setActiveCompetitor] = useState("");

  async function findCompetitors() {
    if (!domainInput.trim()) return;
    setLoadingCompetitors(true);
    setCompetitorsError("");
    setSearchedDomain(domainInput);
    try {
      const res = await fetch(`/api/seo/research/competitors?domain=${encodeURIComponent(domainInput)}`, { cache: "no-store" }).then((r) => r.json());
      if (res.ok) setCompetitors(res.competitors);
      else setCompetitorsError(res.error || "Failed to find competitors.");
    } catch (err) {
      setCompetitorsError((err as Error).message);
    } finally {
      setLoadingCompetitors(false);
    }
  }

  async function analyzeGap(competitorDomain: string) {
    if (!competitorDomain.trim()) return;
    setComparing(true);
    setCompareError("");
    setActiveCompetitor(competitorDomain);
    try {
      const res = await fetch(
        `/api/seo/research/gap?yours=${encodeURIComponent(domainInput)}&competitor=${encodeURIComponent(competitorDomain)}`,
        { cache: "no-store" }
      ).then((r) => r.json());
      if (res.ok) {
        setYourOverview(res.yourOverview);
        setCompetitorOverview(res.competitorOverview);
        setGap(res.gap);
      } else {
        setCompareError(res.error || "Failed to compare domains.");
      }
    } catch (err) {
      setCompareError((err as Error).message);
    } finally {
      setComparing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Your domain + find competitors */}
      <div className="glass-panel p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Users size={16} className="text-cyan-400" /> Find your competitors
        </div>
        <p className="mb-3 text-xs text-slate-500">Enter your domain — we&apos;ll auto-discover who overlaps with you the most in Google rankings.</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && findCompetitors()}
            placeholder="yourdomain.id"
            className="min-w-[220px] flex-1 rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />
          <button
            onClick={findCompetitors}
            disabled={loadingCompetitors || !domainInput.trim()}
            className="flex items-center gap-2 rounded-lg bg-cyan-500/15 px-5 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
          >
            <Users size={15} /> {loadingCompetitors ? "Searching…" : "Find Competitors"}
          </button>
        </div>
      </div>

      {competitorsError && (
        <div className="glass-panel p-4 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
          {competitorsError}
        </div>
      )}

      {searchedDomain && !loadingCompetitors && !competitorsError && (
        <div className="glass-panel p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-100">
            Domains overlapping with <span className="text-cyan-300">{searchedDomain}</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Domain</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Shared Keywords</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Their Organic Keywords</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Est. Organic Traffic/mo</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {competitors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">No overlapping domains found.</td>
                  </tr>
                ) : (
                  competitors.map((c) => (
                    <tr key={c.domain} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-medium text-slate-100">{c.domain}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{formatNumber(c.intersections)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{formatNumber(c.organicKeywords)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{formatNumber(c.organicTrafficEst)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => analyzeGap(c.domain)}
                          className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:bg-cyan-500/15 hover:text-cyan-300"
                        >
                          <Swords size={11} /> Find Gap <ArrowRight size={11} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual head-to-head */}
      <div className="glass-panel p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Swords size={16} className="text-amber-400" /> Compare against a specific competitor
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={manualCompetitor}
            onChange={(e) => setManualCompetitor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyzeGap(manualCompetitor)}
            placeholder="competitordomain.com"
            className="min-w-[220px] flex-1 rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />
          <button
            onClick={() => analyzeGap(manualCompetitor)}
            disabled={comparing || !manualCompetitor.trim()}
            className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
            style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.4)" }}
          >
            <Target size={15} /> {comparing ? "Comparing…" : "Compare"}
          </button>
        </div>
      </div>

      {compareError && (
        <div className="glass-panel p-4 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
          {compareError}
        </div>
      )}

      {activeCompetitor && (yourOverview || competitorOverview) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="glass-panel p-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">You</div>
            <div className="mt-1 truncate text-sm font-semibold text-slate-100">{yourOverview?.domain}</div>
            <div className="mt-3 flex items-center gap-6">
              <div>
                <div className="text-lg font-black text-cyan-300">{formatNumber(yourOverview?.organicKeywords ?? 0)}</div>
                <div className="text-[10px] text-slate-500">organic keywords</div>
              </div>
              <div>
                <div className="text-lg font-black text-cyan-300">{formatNumber(yourOverview?.organicTrafficEst ?? 0)}</div>
                <div className="text-[10px] text-slate-500">est. traffic/mo</div>
              </div>
            </div>
          </div>
          <div className="glass-panel p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.25)" }}>
            <div className="text-[10px] uppercase tracking-wider text-amber-400">Competitor</div>
            <div className="mt-1 truncate text-sm font-semibold text-slate-100">{competitorOverview?.domain}</div>
            <div className="mt-3 flex items-center gap-6">
              <div>
                <div className="text-lg font-black text-amber-300">{formatNumber(competitorOverview?.organicKeywords ?? 0)}</div>
                <div className="text-[10px] text-slate-500">organic keywords</div>
              </div>
              <div>
                <div className="text-lg font-black text-amber-300">{formatNumber(competitorOverview?.organicTrafficEst ?? 0)}</div>
                <div className="text-[10px] text-slate-500">est. traffic/mo</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeCompetitor && (
        <div className="glass-panel p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">Keyword Gap — what {activeCompetitor} has that you don&apos;t</h3>
            <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">{gap.length} keywords</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Keyword</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Volume</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Their Position</th>
                </tr>
              </thead>
              <tbody>
                {comparing ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-slate-500">Loading…</td>
                  </tr>
                ) : gap.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-slate-500">No gap found — either they don&apos;t overlap much, or you already cover their keywords.</td>
                  </tr>
                ) : (
                  gap.map((g) => (
                    <tr key={g.keyword} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-medium text-slate-100">{g.keyword}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{formatNumber(g.volume)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">#{g.competitorPosition}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
