import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { schedulerAuthorized, schedulerConfigured } from "@/lib/services/schedulerAuth";
import type { MediaItem } from "@/lib/services/scheduler";

export const maxDuration = 60;

// Instagram publishes every video as a Reel, and Facebook / TikTok treat a Reel as a plain
// video, so Make only ever has to route on: reel | video | image | carousel | text.
function jobContentType(platform: string, type: string): string {
  if (platform === "instagram" && type === "video") return "reel";
  if (platform !== "instagram" && type === "reel") return "video";
  return type;
}

const MAX_ATTEMPTS = 3;
const STALE_CLAIM_MINUTES = 30;

// Make.com calls this on its schedule. It returns the posts whose time has
// come and marks each destination as "claimed" so a second run cannot publish
// the same post twice. Make then posts them and reports back to /result.
// One job = one destination account (a post going to 3 accounts is 3 jobs).
async function handle(req: NextRequest) {
  if (!schedulerConfigured()) return NextResponse.json({ ok: false, error: "SCHEDULER_SECRET is not set in Vercel yet." }, { status: 503 });
  if (!schedulerAuthorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 10, 1), 25);
  const now = new Date();

  // Lets the app show "Make last checked N minutes ago".
  await db.from("scheduler_state").upsert({ key: "last_poll", value: now.toISOString(), updated_at: now.toISOString() }, { onConflict: "key" });

  // A claim that never got a result (Make failed mid-run) goes back in the
  // queue, up to MAX_ATTEMPTS times, and then is marked failed for a human.
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MINUTES * 60_000).toISOString();
  const { data: stale } = await db.from("scheduled_post_targets").select("id,attempts").eq("status", "claimed").lt("claimed_at", staleBefore);
  for (const t of stale ?? []) {
    if (t.attempts >= MAX_ATTEMPTS) {
      await db.from("scheduled_post_targets").update({ status: "failed", error: "Make did not report a result after several tries." }).eq("id", t.id).eq("status", "claimed");
    } else {
      await db.from("scheduled_post_targets").update({ status: "pending", claimed_at: null }).eq("id", t.id).eq("status", "claimed");
    }
  }

  const { data: posts, error } = await db
    .from("scheduled_posts")
    .select("id,caption,content_type,media,scheduled_at,clients(name)")
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!posts || posts.length === 0) return NextResponse.json({ ok: true, count: 0, jobs: [] });

  const { data: targets, error: tErr } = await db
    .from("scheduled_post_targets")
    .select("id,post_id,platform,handle,external_id,attempts")
    .in("post_id", posts.map((p) => p.id))
    .eq("status", "pending");
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

  const byPost = new Map(posts.map((p) => [p.id, p]));
  const ordered = (targets ?? [])
    .filter((t) => byPost.has(t.post_id))
    .sort((a, b) => Date.parse(byPost.get(a.post_id)!.scheduled_at) - Date.parse(byPost.get(b.post_id)!.scheduled_at))
    .slice(0, limit);

  const jobs = [];
  for (const t of ordered) {
    // The status filter makes the claim atomic: if another run got there first, no row comes back.
    const { data: won } = await db
      .from("scheduled_post_targets")
      .update({ status: "claimed", claimed_at: now.toISOString(), attempts: t.attempts + 1 })
      .eq("id", t.id)
      .eq("status", "pending")
      .select("id");
    if (!won || won.length === 0) continue;

    const p = byPost.get(t.post_id)!;
    const media = (p.media ?? []) as MediaItem[];
    const rel = p.clients as unknown as { name: string } | { name: string }[] | null;
    jobs.push({
      targetId: t.id,
      postId: p.id,
      platform: t.platform,
      handle: t.handle,
      externalId: t.external_id,
      contentType: jobContentType(t.platform, p.content_type), // simplified per platform, see below
      originalContentType: p.content_type,
      caption: p.caption,
      media,
      mediaUrl: media[0]?.url ?? null, // handy for single photo / video posts
      mediaUrls: media.map((m) => m.url),
      client: Array.isArray(rel) ? rel[0]?.name ?? null : rel?.name ?? null,
      scheduledAt: p.scheduled_at,
    });
  }

  return NextResponse.json({ ok: true, count: jobs.length, jobs });
}

export const GET = handle;
export const POST = handle;
