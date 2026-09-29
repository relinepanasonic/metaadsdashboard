// Turns a Reel's numbers into the Hook / Value / CTA verdicts shown in the
// Social Media page. Only uses what Instagram's API really reports per Reel —
// the retention curve and traffic sources exist only inside the Instagram app.
//
// Thresholds live here in one place so they are easy to tune.

export interface PostMetrics {
  media_id: string;
  media_type: string | null;
  media_product_type?: string | null;
  like_count: number | null;
  comments_count: number | null;
  reach?: number | null;
  views?: number | null;
  saved?: number | null;
  shares?: number | null;
  reposts?: number | null;
  total_interactions?: number | null;
  avg_watch_time_ms?: number | null;
  total_watch_ms?: number | null;
  skip_rate?: number | null; // % of plays that left within 3 seconds
  follows?: number | null;
  profile_visits?: number | null;
}

export const MIN_REACH = 50; // below this the percentages are too noisy to judge

export const RULES = {
  hook: { goodMaxSkip: 40, badMinSkip: 60 }, // % skipped in the first 3 seconds
  value: { goodAvgWatchSec: 10, goodSaveRate: 0.01, badAvgWatchSec: 5, badSaveRate: 0.003 },
  cta: { goodRate: 0.01, badRate: 0.003 }, // (comments + shares + reposts) / reach
};

export type Grade = "good" | "bad" | "ok" | "unknown";

export interface Verdict {
  grade: Grade;
  label: string; // "Good Hook"
  metric: string; // "42% skipped in 3s"
  why: string;
  tip: string;
}

export interface ReelVerdicts {
  applicable: boolean; // Reels / videos only
  tooEarly: boolean;
  hook: Verdict;
  value: Verdict;
  cta: Verdict;
  winner: boolean; // strong hook AND strong value, nothing bad — a clone candidate
}

export function isReel(p: Pick<PostMetrics, "media_type" | "media_product_type">): boolean {
  return p.media_product_type === "REELS" || p.media_type === "VIDEO";
}

const pct = (n: number, dp = 1) => `${n.toFixed(dp)}%`;
const num = (v: number | null | undefined) => (typeof v === "number" ? v : 0);

export function saveRate(p: PostMetrics): number | null {
  return p.reach && p.reach > 0 ? num(p.saved) / p.reach : null;
}
export function actionRate(p: PostMetrics): number | null {
  return p.reach && p.reach > 0 ? (num(p.comments_count) + num(p.shares) + num(p.reposts)) / p.reach : null;
}

export function judgeReel(p: PostMetrics): ReelVerdicts {
  const unknown = (label: string): Verdict => ({ grade: "unknown", label, metric: "no data yet", why: "", tip: "" });
  if (!isReel(p)) return { applicable: false, tooEarly: false, hook: unknown("Hook"), value: unknown("Value"), cta: unknown("CTA"), winner: false };

  const tooEarly = !p.reach || p.reach < MIN_REACH;
  if (tooEarly) {
    const early = (label: string): Verdict => ({ grade: "unknown", label, metric: p.reach ? `reach ${p.reach} — too early` : "no data yet", why: "", tip: "" });
    return { applicable: true, tooEarly: true, hook: early("Hook"), value: early("Value"), cta: early("CTA"), winner: false };
  }

  // ---- Hook: did people stay past the first 3 seconds? ----------------------
  let hook: Verdict;
  if (p.skip_rate == null) {
    hook = unknown("Hook");
  } else if (p.skip_rate <= RULES.hook.goodMaxSkip) {
    hook = { grade: "good", label: "Good Hook", metric: `${pct(p.skip_rate)} left within 3s`, why: `Only ${pct(p.skip_rate, 0)} of viewers swiped away in the first 3 seconds — the opening works.`, tip: "Reuse this opening: same first line, same visual, same pace." };
  } else if (p.skip_rate >= RULES.hook.badMinSkip) {
    hook = { grade: "bad", label: "Bad Hook", metric: `${pct(p.skip_rate)} left within 3s`, why: `${pct(p.skip_rate, 0)} of viewers swiped away in the first 3 seconds — the opening does not earn attention.`, tip: "Open with the payoff or a question in the first second; put text on screen immediately; cut any intro." };
  } else {
    hook = { grade: "ok", label: "OK Hook", metric: `${pct(p.skip_rate)} left within 3s`, why: "Average opening — not losing people, not grabbing them.", tip: "Test a sharper first line against this one." };
  }

  // ---- Value: did people watch and keep it? ----------------------------------
  const avgSec = p.avg_watch_time_ms != null ? p.avg_watch_time_ms / 1000 : null;
  const sRate = saveRate(p);
  let value: Verdict;
  if (avgSec == null && sRate == null) {
    value = unknown("Value");
  } else {
    const goodWatch = avgSec != null && avgSec >= RULES.value.goodAvgWatchSec;
    const goodSave = sRate != null && sRate >= RULES.value.goodSaveRate;
    const badWatch = avgSec != null && avgSec < RULES.value.badAvgWatchSec;
    const badSave = sRate == null || sRate < RULES.value.badSaveRate;
    const metric = `${avgSec != null ? `${avgSec.toFixed(1)}s avg watch` : "—"} · ${sRate != null ? pct(sRate * 100) : "—"} saved`;
    if (goodWatch || goodSave) {
      value = { grade: "good", label: "Good Value", metric, why: goodWatch && goodSave ? "People watch a long time and save it for later." : goodWatch ? `Viewers stay ${avgSec!.toFixed(0)}s on average — the content holds them.` : "A high share of viewers saved it — they want to come back to it.", tip: "Keep this format and depth; make more on the same topic." };
    } else if (badWatch && badSave) {
      value = { grade: "bad", label: "Bad Value", metric, why: "Viewers leave quickly and almost nobody saves it — the content is not giving them enough.", tip: "Deliver the useful part sooner, cut filler, and give one clear takeaway worth saving." };
    } else {
      value = { grade: "ok", label: "OK Value", metric, why: "Middling watch time and saves.", tip: "Add a tip or checklist people would want to keep." };
    }
  }

  // ---- CTA: did people act (comment / share / repost)? ---------------------
  const aRate = actionRate(p);
  let cta: Verdict;
  if (aRate == null) {
    cta = unknown("CTA");
  } else {
    const metric = `${pct(aRate * 100)} commented / shared / reposted`;
    if (aRate >= RULES.cta.goodRate) {
      cta = { grade: "good", label: "Good CTA", metric, why: "A solid share of viewers reacted with a comment, share or repost.", tip: "Keep the same closing line / prompt." };
    } else if (aRate < RULES.cta.badRate) {
      cta = { grade: "bad", label: "Bad CTA", metric, why: "Almost nobody commented, shared or reposted — there was no reason to act.", tip: "End with one specific ask (\"comment AC if you want the checklist\", \"send this to someone who…\")." };
    } else {
      cta = { grade: "ok", label: "OK CTA", metric, why: "Some reaction, but the closing ask could be stronger.", tip: "Make the ask more specific and easy to answer." };
    }
  }

  const winner = hook.grade === "good" && value.grade === "good" && cta.grade !== "bad";
  return { applicable: true, tooEarly: false, hook, value, cta, winner };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
