import { db } from "@/lib/supabase/db";
import { fetchProfile, fetchDayInsights, fetchRecentMedia, fetchDemographics, AUDIENCES, BREAKDOWNS } from "./instagram";

export interface SyncResult {
  igUserId: string;
  username: string;
  daysStored: number;
  postsStored: number;
  demographicsStored: number;
  demographicsNote?: string;
  errors: string[];
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Pulls one Instagram account and stores it: `days` most recent completed
// days of insights (day 1 = yesterday), the current follower count on the
// latest day, and the newest posts with like/comment counts.
export async function syncInstagramAccount(igUserId: string, days: number): Promise<SyncResult> {
  if (!db) throw new Error("Supabase not configured");
  const errors: string[] = [];

  const profile = await fetchProfile(igUserId); // throws on missing access — caller reports it

  const dates = Array.from({ length: days }, (_, i) => isoDaysAgo(i + 1));
  const rows: Record<string, unknown>[] = [];

  // Small batches keep us well inside Graph API rate limits.
  for (let i = 0; i < dates.length; i += 5) {
    const batch = dates.slice(i, i + 5);
    const settled = await Promise.allSettled(batch.map((date) => fetchDayInsights(igUserId, date)));
    settled.forEach((r, idx) => {
      if (r.status === "rejected") errors.push(`${batch[idx]}: ${(r.reason as Error).message}`);
      else rows.push({ ig_user_id: igUserId, snapshot_date: batch[idx], ...r.value });
    });
  }

  // Rows are written one at a time on purpose: a bulk upsert fills any column
  // missing from a row with NULL, which would erase values stored earlier
  // (e.g. yesterday's follower count when re-syncing a 2-day window).
  const write = async (row: Record<string, unknown>) => {
    const { error } = await db!.from("instagram_snapshots").upsert(row, { onConflict: "ig_user_id,snapshot_date" });
    if (error) errors.push(`snapshots: ${error.message}`);
  };
  for (let i = 0; i < rows.length; i += 10) await Promise.all(rows.slice(i, i + 10).map(write));

  // Follower count is stored even when insights are blocked, so the account
  // shows up (and starts building history) before that permission is granted.
  await write({ ig_user_id: igUserId, snapshot_date: dates[0], followers_count: profile.followers_count, media_count: profile.media_count });

  let postsStored = 0;
  try {
    const media = await fetchRecentMedia(igUserId);
    if (media.length > 0) {
      const { error } = await db.from("instagram_posts").upsert(
        media.map((m) => ({
          media_id: m.id,
          ig_user_id: igUserId,
          caption: m.caption ?? null,
          media_type: m.media_type ?? null,
          permalink: m.permalink ?? null,
          posted_at: m.timestamp ?? null,
          like_count: m.like_count ?? null,
          comments_count: m.comments_count ?? null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "media_id" }
      );
      if (error) errors.push(`posts: ${error.message}`);
      else postsStored = media.length;
    }
  } catch (err) {
    errors.push(`posts: ${(err as Error).message}`);
  }

  // Audience demographics: a current picture only, kept once per month (the
  // latest reading that month wins). Instagram refuses accounts under 100
  // followers, so those are skipped with a note rather than an error.
  let demographicsStored = 0;
  let demographicsNote: string | undefined;
  if (profile.followers_count < 100) {
    demographicsNote = "needs 100+ followers for demographics";
  } else {
    const month = new Date().toISOString().slice(0, 7);
    const jobs = AUDIENCES.flatMap((audience) => BREAKDOWNS.map((breakdown) => ({ audience, breakdown })));
    const settled = await Promise.allSettled(jobs.map((j) => fetchDemographics(igUserId, j.audience, j.breakdown)));

    for (let i = 0; i < jobs.length; i++) {
      const r = settled[i];
      const { audience, breakdown } = jobs[i];
      if (r.status === "rejected") {
        errors.push(`demographics: ${(r.reason as Error).message}`);
        continue;
      }
      if (r.value.length === 0) continue;

      // Replace the month's earlier reading so keys that dropped out don't linger.
      await db.from("instagram_demographics").delete().match({ ig_user_id: igUserId, snapshot_month: month, audience, breakdown });
      const { error } = await db.from("instagram_demographics").insert(
        r.value.map((d) => ({ ig_user_id: igUserId, snapshot_month: month, audience, breakdown, key: d.key, value: Math.round(d.value) }))
      );
      if (error) errors.push(`demographics: ${error.message}`);
      else demographicsStored += r.value.length;
    }
  }

  return { igUserId, username: profile.username, daysStored: rows.length, postsStored, demographicsStored, demographicsNote, errors };
}
