import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { schedulerAuthorized, schedulerConfigured } from "@/lib/services/schedulerAuth";
import { publishInstagramCarousel } from "@/lib/services/instagramPublish";
import type { MediaItem } from "@/lib/services/scheduler";

export const maxDuration = 300;

// Make.com calls this for an Instagram carousel job (one HTTP module, nothing else
// on that route): { targetId }. We publish it ourselves and record the outcome, so
// Make does not need a separate "report back" step. The response is always 200
// once the job was found — read `ok` / `error` in the body — so Make's error
// handler is only for real transport problems.
export async function POST(req: NextRequest) {
  if (!schedulerConfigured()) return NextResponse.json({ ok: false, error: "SCHEDULER_SECRET is not set in Vercel yet." }, { status: 503 });
  if (!schedulerAuthorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  let targetId: string | undefined;
  if ((req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    targetId = new URLSearchParams(await req.text()).get("targetId") ?? undefined;
  } else {
    targetId = ((await req.json().catch(() => ({}))) as { targetId?: string }).targetId;
  }
  if (!targetId) return NextResponse.json({ ok: false, error: "targetId is required" }, { status: 400 });

  const { data: target } = await db
    .from("scheduled_post_targets")
    .select("id,platform,external_id,status,scheduled_posts(caption,content_type,media)")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return NextResponse.json({ ok: false, error: "Unknown targetId" }, { status: 404 });
  if (target.status !== "claimed") return NextResponse.json({ ok: true, ignored: true, note: `Target is ${target.status}, not claimed — nothing done.` });

  const rel = target.scheduled_posts as unknown as { caption: string; content_type: string; media: MediaItem[] } | { caption: string; content_type: string; media: MediaItem[] }[] | null;
  const post = Array.isArray(rel) ? rel[0] : rel;

  const fail = async (message: string) => {
    await db!.from("scheduled_post_targets").update({ status: "failed", error: message.slice(0, 500) }).eq("id", targetId).eq("status", "claimed");
    return NextResponse.json({ ok: false, error: message });
  };

  // This endpoint only handles Instagram carousels. If Make sends it anything else (a route
  // without a filter), leave the job completely alone so the right route can publish it.
  if (target.platform !== "instagram" || post?.content_type !== "carousel") {
    return NextResponse.json({ ok: true, ignored: true, note: "Not an Instagram carousel — nothing done." });
  }
  if (!target.external_id || !post) return fail("This Instagram post has no account ID.");

  try {
    const result = await publishInstagramCarousel(target.external_id, post.media ?? [], post.caption ?? "");
    await db
      .from("scheduled_post_targets")
      .update({ status: "published", published_at: new Date().toISOString(), published_id: result.mediaId, published_url: result.permalink, error: null })
      .eq("id", targetId)
      .eq("status", "claimed");
    return NextResponse.json({ ok: true, mediaId: result.mediaId, permalink: result.permalink });
  } catch (err) {
    return fail((err as Error).message);
  }
}
