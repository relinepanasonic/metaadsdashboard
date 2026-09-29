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

// Make's Instagram module picks its account by the Facebook Page the Instagram
// account is connected to, so each Instagram job carries that Page's id. Read once
// per run from the token's Pages; an account the token cannot see simply gets null.
async function instagramPageIds(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return out;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${process.env.META_API_VERSION || "v21.0"}/me/accounts?fields=id,instagram_business_account{id}&limit=200&access_token=${token}`,
      { cache: "no-store" }
    );
    const json = (await res.json()) as { data?: { id: string; instagram_business_account?: { id: string } }[] };
    for (const page of json.data ?? []) if (page.instagram_business_account?.id) out.set(page.instagram_business_account.id, page.id);
  } catch {
    // Make can still use a fixed Page in its module if this lookup fails
  }
  return out;
}

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

  // A claim that never got a result means Make stopped mid-run, or posted but could not
  // report back. Re-posting automatically could publish it twice, so it is marked failed
  // for a person to check the account and press Retry if it really did not go out.
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MINUTES * 60_000).toISOString();
  await db
    .from("scheduled_post_targets")
    .update({ status: "failed", error: "No result came back from Make. It may have been posted — check the account, then press Retry only if it did not go out." })
    .eq("status", "claimed")
    .lt("claimed_at", staleBefore);

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

  const pageIds = ordered.some((t) => t.platform === "instagram") ? await instagramPageIds() : new Map<string, string>();
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
      // Facebook Page id: for Facebook it is the Page itself, for Instagram the Page the account is connected to
      pageId: t.platform === "facebook" ? t.external_id : t.platform === "instagram" && t.external_id ? pageIds.get(t.external_id) ?? null : null,
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
