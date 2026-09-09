"use client";

import { useState } from "react";
import { Search, List, Bookmark, BookmarkCheck, BookmarkPlus } from "lucide-react";
import { formatNumber } from "@/lib/format";

interface RankedKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  position: number;
  url: string;
}

interface SaveKeywordPayload {
  keyword: string;
  volume: number;
  difficulty?: number;
  cpcUsd?: number;
  position?: number;
  source: string;
  context: string;
}

export default function CompetitorAnalysis({
  onSave,
  isSaved,
}: {
  onSave: (payload: SaveKeywordPayload) => void;
  isSaved: (keyword: string, source: string, context: string) => boolean;
}) {
  const [domain, setDomain] = useState("");
  const [searchedDomain, setSearchedDomain] = useState("");
  const [keywords, setKeywords] = useState<RankedKeyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingAll, setSavingAll] = useState(false);

  async function analyze() {
    const d = domain.trim();
    if (!d) return;
    setLoading(true);
    setError("");
    setSearchedDomain(d);
    try {
      const res = await fetch(`/api/seo/research/ranked-keywords?domain=${encodeURIComponent(d)}&limit=100`, { cache: "no-store" }).then((r) => r.json());
      if (res.ok) setKeywords(res.keywords);
      else setError(res.error || "Failed to load keywords.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveAll() {
    setSavingAll(true);
    for (const k of keywords) {
      if (!isSaved(k.keyword, "ranked", searchedDomain)) {
        onSave({ keyword: k.keyword, volume: k.volume, difficulty: k.difficulty, position: k.position, source: "ranked", context: searchedDomain });
      }
    }
    setSavingAll(false);
  }

  const unsavedCount = searchedDomain ? keywords.filter((k) => !isSaved(k.keyword, "ranked", searchedDomain)).length : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Input */}
      <div className="glass-panel p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Search size={16} className="text-amber-400" /> Competitor Keywords
        </div>
        <p className="mb-3 text-xs text-slate-500">Enter a competitor&apos;s domain to see all keywords they rank for, sorted by highest volume.</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            placeholder="competitor.com"
            className="min-w-[220px] flex-1 rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />
          <button
            onClick={analyze}
            disabled={loading || !domain.trim()}
            className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
            style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.4)" }}
          >
            <List size={15} /> {loading ? "Loading…" : "Get Keywords"}
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel p-4 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
          {error}
        </div>
      )}

      {/* Results */}
      {searchedDomain && !loading && keywords.length > 0 && (
        <div className="glass-panel p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">
              Keywords <span className="text-amber-300">{searchedDomain}</span> ranks for
            </h3>
            <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">{keywords.length}</span>
            {unsavedCount > 0 && (
              <button
                onClick={saveAll}
                disabled={savingAll}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" }}
              >
                <BookmarkPlus size={13} /> Save All ({unsavedCount})
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Keyword</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Volume</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Position</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Save</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((k) => {
                  const saved = isSaved(k.keyword, "ranked", searchedDomain);
                  return (
                    <tr key={k.keyword} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-medium text-slate-100">{k.keyword}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{formatNumber(k.volume)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">#{k.position}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() =>
                            onSave({ keyword: k.keyword, volume: k.volume, difficulty: k.difficulty, position: k.position, source: "ranked", context: searchedDomain })
                          }
                          title={saved ? "Remove from saved" : "Save keyword"}
                          className={`rounded-md p-1.5 ${saved ? "text-cyan-400 hover:bg-rose-500/10 hover:text-rose-300" : "text-slate-500 hover:bg-white/[0.08] hover:text-slate-200"}`}
                        >
                          {saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {searchedDomain && !loading && keywords.length === 0 && !error && (
        <div className="glass-panel p-6 text-center text-xs text-slate-500">No ranked keywords found for {searchedDomain}.</div>
      )}
    </div>
  );
}
