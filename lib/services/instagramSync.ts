import { db } from "@/lib/supabase/db";
import { fetchProfile, fetchDayInsights, fetchRecentMedia, fetchPostInsights, fetchDemographics, AUDIENCES, BREAKDOWNS } from "./instagram";

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
    const media = await fetchRecentMedia(igUserId, 50);
    if (media.length > 0) {
      const baseRow = (m: (typeof media)[number]) => ({
        media_id: m.id,
        ig_user_id: igUserId,
        caption: m.caption ?? null,
        media_type: m.media_type ?? null,
        permalink: m.permalink ?? null,
        posted_at: m.timestamp ?? null,
        like_count: m.like_count ?? null,
        comments_count: m.comments_count ?? null,
        // These CDN links expire (~24h), so they're only good for as long as a
        // post keeps showing up in fetchRecentMedia — this upsert refreshes
        // them every night for whatever's still in that window.
        thumbnail_url: m.thumbnail_url ?? null,
        updated_at: new Date().toISOString(),
      });
      let { error } = await db.from("instagram_posts").upsert(
        media.map((m) => ({ ...baseRow(m), media_url: m.media_url ?? null })),
        { onConflict: "media_id" }
      );
      // media_url needs migration 0022 — fall back to storing without it so
      // captions/likes/thumbnails still sync until that's run.
      if (error?.message.includes("media_url")) {
        ({ error } = await db.from("instagram_posts").upsert(media.map(baseRow), { onConflict: "media_id" }));
        if (!error) errors.push("posts: media_url column missing — run migration 0022");
      }
      if (error) errors.push(`posts: ${error.message}`);
      else postsStored = media.length;

      // Per-post results (reach, saves, shares, watch time, 3-second skip rate).
      // These keep growing for a few weeks, so posts under 45 days old are
      // re-read on every run; older ones keep their last stored values.
      const cutoff = Date.now() - 45 * 86_400_000;
      const recent = media.filter((m) => m.timestamp && Date.parse(m.timestamp) > cutoff);
      const OPTIONAL = ["skip_rate", "reposts"]; // need migration 0023
      let missingOptional = false;
      const saveInsights = async (m: (typeof media)[number]) => {
        const ins = await fetchPostInsights(m);
        let row: Record<string, unknown> = { media_product_type: m.media_product_type ?? null, ...ins, insights_updated_at: new Date().toISOString() };
        let { error: e } = await db!.from("instagram_posts").update(row).eq("media_id", m.id);
        if (e && OPTIONAL.some((c) => e!.message.includes(c))) {
          missingOptional = true;
          row = Object.fromEntries(Object.entries(row).filter(([k]) => !OPTIONAL.includes(k)));
          ({ error: e } = await db!.from("instagram_posts").update(row).eq("media_id", m.id));
        }
        if (e) errors.push(`post insights: ${e.message}`);
      };
      for (let i = 0; i < recent.length; i += 5) await Promise.all(recent.slice(i, i + 5).map(saveInsights));
      if (missingOptional) errors.push("run migration 0023 to store Reel skip rate and reposts");
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
