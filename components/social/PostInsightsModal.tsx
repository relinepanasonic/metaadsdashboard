"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bookmark, ExternalLink, Heart, ImageOff, Info, MessageCircle, Play, Repeat2, Send, Star, X } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { isReel, judgeReel, median, saveRate, type Grade, type PostMetrics, type Verdict } from "@/lib/social/reelBadges";

export interface InsightPost extends PostMetrics {
  caption: string | null;
  permalink: string | null;
  posted_at: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  account: string;
}

const GRADE_STYLE: Record<Grade, { bg: string; text: string; ring: string }> = {
  good: { bg: "rgba(52,211,153,0.10)", text: "#6ee7b7", ring: "rgba(52,211,153,0.35)" },
  bad: { bg: "rgba(251,113,133,0.10)", text: "#fda4af", ring: "rgba(251,113,133,0.35)" },
  ok: { bg: "rgba(148,163,184,0.08)", text: "#cbd5e1", ring: "rgba(148,163,184,0.25)" },
  unknown: { bg: "rgba(148,163,184,0.05)", text: "#64748b", ring: "rgba(148,163,184,0.15)" },
};

// Small coloured chip used in the table and in the panel.
export function VerdictChip({ v }: { v: Verdict }) {
  const s = GRADE_STYLE[v.grade];
  return (
    <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: s.bg, color: s.text, boxShadow: `inset 0 0 0 1px ${s.ring}` }} title={v.metric}>
      {v.label}
    </span>
  );
}

function duration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-3.5">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black text-slate-100">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Scorecard({ title, v }: { title: string; v: Verdict }) {
  const s = GRADE_STYLE[v.grade];
  return (
    <div className="rounded-xl p-3.5" style={{ background: s.bg, boxShadow: `inset 0 0 0 1px ${s.ring}` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</span>
        <VerdictChip v={v} />
      </div>
      <div className="mt-2 text-xs font-semibold text-slate-100">{v.metric}</div>
      {v.why && <div className="mt-1 text-[11px] leading-relaxed text-slate-400">{v.why}</div>}
      {v.tip && <div className="mt-1.5 text-[11px] font-medium" style={{ color: s.text }}>→ {v.tip}</div>}
    </div>
  );
}

// "vs your typical Reel": this post against the median of the account's other Reels.
function VsTypical({ label, value, typical, format, lowerIsBetter = false }: { label: string; value: number | null; typical: number | null; format: (n: number) => string; lowerIsBetter?: boolean }) {
  if (value == null) return null;
  const ratio = typical && typical > 0 ? value / typical : null;
  const better = ratio == null ? null : lowerIsBetter ? ratio < 1 : ratio > 1;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2 text-xs last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="flex items-center gap-3">
        <span className="font-semibold text-slate-100">{format(value)}</span>
        <span className="w-[120px] text-right text-[11px] text-slate-500">
          {typical != null ? `typical ${format(typical)}` : "—"}
          {ratio != null && Math.abs(ratio - 1) >= 0.1 && (
            <span className={`ml-1.5 font-semibold ${better ? "text-emerald-300" : "text-rose-300"}`}>{ratio >= 1 ? "▲" : "▼"}{Math.abs((ratio - 1) * 100).toFixed(0)}%</span>
          )}
        </span>
      </span>
    </div>
  );
}

export default function PostInsightsModal({ post, peers, onClose }: { post: InsightPost; peers: PostMetrics[]; onClose: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const reel = isReel(post);
  const verdicts = judgeReel(post);
  const cover = post.thumbnail_url || post.media_url;
  const reach = post.reach ?? null;
  const views = post.views ?? null;
  const others = peers.filter((p) => p.media_id !== post.media_id && isReel(p) === reel);
  const med = (pick: (p: PostMetrics) => number | null | undefined) => median(others.map(pick).filter((v): v is number => typeof v === "number"));
  const hasInsights = reach != null || views != null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-[860px] rounded-2xl border border-white/[0.12] bg-[#0e1420] p-4 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-label="Post insights">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white" aria-label="Close">
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex gap-4 pr-8">
          <div className="relative h-[150px] w-[84px] shrink-0 overflow-hidden rounded-xl bg-white/[0.04]" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
            {cover && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived external Meta CDN URL
              <img src={cover} alt="" className="h-full w-full object-cover" onError={() => setImgFailed(true)} />
            ) : (
              <div className="grid h-full place-items-center text-slate-600"><ImageOff size={20} /></div>
            )}
            {reel && cover && !imgFailed && <span className="absolute inset-0 grid place-items-center bg-black/20"><Play size={18} className="fill-white text-white" /></span>}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">{reel ? "Reel insights" : "Post insights"}</div>
            <div className="mt-1 text-sm font-semibold leading-snug text-slate-100">{(post.caption ?? "(no caption)").slice(0, 220)}</div>
            <div className="mt-1.5 text-[11px] text-slate-500">{post.account} · {post.posted_at?.slice(0, 10) ?? "—"} · {(post.media_product_type ?? post.media_type ?? "").toLowerCase().replace("_", " ")}</div>
            {post.permalink && (
              <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:underline">
                Open in Instagram <ExternalLink size={10} />
              </a>
            )}
            {verdicts.winner && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold text-amber-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.4)" }}>
                <Star size={11} className="fill-amber-300" /> Clone candidate — strong hook and value
              </div>
            )}
          </div>
        </div>

        {/* Engagement row (same order as the Instagram app) */}
        <div className="mt-5 grid grid-cols-5 gap-2 rounded-xl bg-white/[0.03] p-3 text-center">
          {[
            { icon: Heart, label: "Likes", v: post.like_count },
            { icon: MessageCircle, label: "Comments", v: post.comments_count },
            { icon: Repeat2, label: "Reposts", v: post.reposts },
            { icon: Send, label: "Shares", v: post.shares },
            { icon: Bookmark, label: "Saves", v: post.saved },
          ].map(({ icon: Icon, label, v }) => (
            <div key={label}>
              <Icon size={18} className="mx-auto text-slate-300" />
              <div className="mt-1 text-base font-black text-slate-100">{v != null ? formatNumber(v) : "—"}</div>
              <div className="text-[10px] text-slate-500">{label}</div>
            </div>
          ))}
        </div>

        {!hasInsights ? (
          <div className="mt-5 rounded-xl bg-amber-500/10 p-4 text-xs text-amber-200">
            Detailed insights for this post haven&apos;t been stored yet. They&apos;re collected by the daily sync for posts from the last 45 days — press <b>Sync</b> on the Social Media page to fetch them now.
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="mt-5 text-sm font-semibold text-slate-100">Summary</div>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Views" value={views != null ? formatNumber(views) : "—"} />
              <Tile label="Reach" value={reach != null ? formatNumber(reach) : "—"} sub={views && reach ? `${(views / reach).toFixed(2)} views per person` : undefined} />
              {reel ? (
                <>
                  <Tile label="Avg. watch time" value={duration(post.avg_watch_time_ms)} />
                  <Tile label="Total watch time" value={duration(post.total_watch_ms)} />
                </>
              ) : (
                <>
                  <Tile label="Follows from post" value={post.follows != null ? formatNumber(post.follows) : "—"} />
                  <Tile label="Profile visits" value={post.profile_visits != null ? formatNumber(post.profile_visits) : "—"} />
                </>
              )}
            </div>

            {/* Hook / Value / CTA */}
            {verdicts.applicable && (
              <>
                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-100">
                  Content scorecard
                  {verdicts.tooEarly && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-400">needs {50}+ reach to judge</span>}
                </div>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Scorecard title="Hook · first 3 seconds" v={verdicts.hook} />
                  <Scorecard title="Value · worth watching" v={verdicts.value} />
                  <Scorecard title="CTA · made people act" v={verdicts.cta} />
                </div>
              </>
            )}

            {/* Versus typical */}
            {others.length >= 2 && (
              <>
                <div className="mt-6 text-sm font-semibold text-slate-100">vs your typical {reel ? "Reel" : "post"} <span className="text-[11px] font-normal text-slate-500">(median of {others.length} others on this account)</span></div>
                <div className="mt-1">
                  <VsTypical label="Views" value={views} typical={med((p) => p.views)} format={(n) => formatNumber(n)} />
                  <VsTypical label="Reach" value={reach} typical={med((p) => p.reach)} format={(n) => formatNumber(n)} />
                  {reel && <VsTypical label="Avg. watch time" value={post.avg_watch_time_ms != null ? post.avg_watch_time_ms / 1000 : null} typical={med((p) => (p.avg_watch_time_ms != null ? p.avg_watch_time_ms / 1000 : null))} format={(n) => `${n.toFixed(1)}s`} />}
                  {reel && <VsTypical label="Skipped within 3s" value={post.skip_rate ?? null} typical={med((p) => p.skip_rate)} format={(n) => `${n.toFixed(1)}%`} lowerIsBetter />}
                  <VsTypical label="Save rate" value={saveRate(post) != null ? saveRate(post)! * 100 : null} typical={med((p) => (saveRate(p) != null ? saveRate(p)! * 100 : null))} format={(n) => `${n.toFixed(2)}%`} />
                </div>
              </>
            )}
          </>
        )}

        <div className="mt-6 flex items-start gap-2 rounded-xl bg-white/[0.03] p-3 text-[11px] leading-relaxed text-slate-500">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            Instagram only shares the retention curve, views-over-time, top sources of views and the follower / age split inside its own app — they are not available to any dashboard. Everything above comes from the numbers Instagram does provide per {reel ? "Reel" : "post"}.
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
