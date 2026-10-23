import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// Everything the Radar page shows for one of our Instagram accounts: its watchlist, the ranked Reels, the latest weekly brief.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ ok: false, error: "accountId is required" }, { status: 400 });
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 60, 7), 180);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [watch, reels, brief, tests] = await Promise.all([
    db.from("radar_watch").select("id,handle,note,followers,last_collected_at,last_error").eq("account_id", accountId).order("created_at"),
    db
      .from("radar_reels")
      .select("id,watch_id,handle,caption,permalink,thumbnail_url,posted_at,views,likes,comments,followers,outlier,score_basis,decode,decode_mode,decoded_at,decode_error,media_url")
      .eq("account_id", accountId)
      .gte("posted_at", since)
      .not("outlier", "is", null)
      .order("outlier", { ascending: false })
      .limit(80),
    db.from("radar_briefs").select("id,summary,provider,created_at").eq("account_id", accountId).order("created_at", { ascending: false }).limit(1),
    db.from("radar_tests").select("id,title,notes,variants,created_at").eq("account_id", accountId).order("created_at", { ascending: false }).limit(20),
  ]);
  if (watch.error) return NextResponse.json({ ok: false, error: watch.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    watch: watch.data ?? [],
    reels: (reels.data ?? []).map((r) => ({ ...r, hasVideo: Boolean(r.media_url), media_url: undefined })),
    brief: brief.data?.[0] ?? null,
    tests: tests.data ?? [],
  });
}
