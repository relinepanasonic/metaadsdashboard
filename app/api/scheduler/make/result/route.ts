import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { schedulerAuthorized, schedulerConfigured } from "@/lib/services/schedulerAuth";

// Make.com reports what happened to one job it took from /due:
//   { "targetId": "...", "status": "published", "url": "https://…", "platformPostId": "…" }
//   { "targetId": "...", "status": "failed",    "error": "what Instagram said" }
export async function POST(req: NextRequest) {
  if (!schedulerConfigured()) return NextResponse.json({ ok: false, error: "SCHEDULER_SECRET is not set in Vercel yet." }, { status: 503 });
  if (!schedulerAuthorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  // Make's "x-www-form-urlencoded" body type escapes error messages for you, JSON needs care with quotes — accept both.
  type Body = { targetId?: string; status?: string; url?: string; platformPostId?: string; error?: string };
  let body: Body = {};
  if ((req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    body = Object.fromEntries(new URLSearchParams(await req.text())) as Body;
  } else {
    body = (await req.json().catch(() => ({}))) as Body;
  }
  if (!body.targetId) return NextResponse.json({ ok: false, error: "targetId is required" }, { status: 400 });
  if (body.status !== "published" && body.status !== "failed") {
    return NextResponse.json({ ok: false, error: 'status must be "published" or "failed"' }, { status: 400 });
  }

  const patch =
    body.status === "published"
      ? { status: "published", published_at: new Date().toISOString(), published_url: body.url?.slice(0, 500) ?? null, published_id: body.platformPostId?.slice(0, 200) ?? null, error: null }
      : { status: "failed", error: (body.error || "Make reported a failure").slice(0, 500) };

  // Only a job that is still in flight can be updated — a late duplicate report never overwrites a result.
  const { data, error } = await db.from("scheduled_post_targets").update(patch).eq("id", body.targetId).in("status", ["claimed", "pending"]).select("id");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ ok: true, ignored: true });
  return NextResponse.json({ ok: true });
}
