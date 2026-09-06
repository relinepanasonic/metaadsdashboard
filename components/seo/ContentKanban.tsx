"use client";

import { useState } from "react";
import { Sparkles, Send, FileText, PenLine, Eye, CheckCircle2, Wand2 } from "lucide-react";
import type { ContentItem, PipelineStage } from "@/lib/seo/mock";
import CustomSelect from "@/components/CustomSelect";

const STAGES: { key: PipelineStage; icon: typeof FileText; color: string }[] = [
  { key: "Briefing", icon: FileText, color: "#8b5cf6" },
  { key: "AI Drafting", icon: PenLine, color: "#22d3ee" },
  { key: "Review", icon: Eye, color: "#fbbf24" },
  { key: "Published", icon: CheckCircle2, color: "#34d399" },
];

const TONES = ["Helpful", "Persuasive", "Educational", "Trustworthy", "Neutral", "Informative"];

export default function ContentKanban({ items }: { items: ContentItem[] }) {
  const [keyword, setKeyword] = useState("");
  const [tone, setTone] = useState("Helpful");

  return (
    <div className="flex flex-col gap-4">
      {/* Generate form */}
      <div className="glass-panel p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Wand2 size={15} className="text-cyan-400" /> Generate New Brief
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-500">Target Keyword</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. cara merawat AC"
              className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-500">Tone</label>
            <CustomSelect className="min-w-[160px]" value={tone} onChange={setTone} options={TONES.map((t) => ({ value: t, label: t }))} />
          </div>
          <button
            className="flex items-center gap-2 rounded-lg bg-cyan-500/15 px-5 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/25"
            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
          >
            <Sparkles size={15} /> Create Brief
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((stage) => {
          const cards = items.filter((i) => i.stage === stage.key);
          const StageIcon = stage.icon;
          return (
            <div key={stage.key} className="glass-panel flex flex-col p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <StageIcon size={14} style={{ color: stage.color }} />
                <span className="text-xs font-semibold text-slate-200">{stage.key}</span>
                <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-slate-400">{cards.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {cards.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/[0.08] py-6 text-center text-[11px] text-slate-600">Empty</div>
                ) : (
                  cards.map((c) => (
                    <div key={c.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="text-xs font-semibold leading-snug text-slate-100">{c.title}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-slate-400">{c.keyword}</span>
                        <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300">{c.tone}</span>
                        {c.aeoOptimized && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">AEO</span>}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                        <span>{c.words > 0 ? `${c.words} words` : "not started"}</span>
                        {c.stage === "Review" && (
                          <button className="flex items-center gap-1 rounded-md bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-500/25">
                            <Send size={10} /> Push to WordPress
                          </button>
                        )}
                        {c.stage === "Published" && <span className="text-emerald-400">● Live</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
