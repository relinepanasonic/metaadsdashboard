import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Everything the Social Media page needs in one call: per client with an
// Instagram account, its stored daily snapshots (last 120 days, enough for
// a 60-day range plus the previous period to compare against) and recent posts.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: true, accounts: [] });

  const { data: clients, error } = await db
    .from("clients")
    .select("id,name,instagram_handle,instagram_user_id")
    .not("instagram_user_id", "is", null)
    .order("name");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const ids = (clients ?? []).map((c) => c.instagram_user_id as string);
  if (ids.length === 0) return NextResponse.json({ ok: true, accounts: [] });

  const [snaps, posts] = await Promise.all([
    db
      .from("instagram_snapshots")
      .select("ig_user_id,snapshot_date,followers_count,reach,views,profile_views,accounts_engaged,total_interactions")
      .in("ig_user_id", ids)
      .gte("snapshot_date", isoDaysAgo(120))
      .order("snapshot_date", { ascending: true }),
    db
      .from("instagram_posts")
      .select("media_id,ig_user_id,caption,media_type,permalink,posted_at,like_count,comments_count")
      .in("ig_user_id", ids)
      .order("posted_at", { ascending: false })
      .limit(300),
  ]);
  if (snaps.error) return NextResponse.json({ ok: false, error: snaps.error.message }, { status: 500 });
  if (posts.error) return NextResponse.json({ ok: false, error: posts.error.message }, { status: 500 });

  const accounts = (clients ?? []).map((c) => ({
    clientId: c.id,
    clientName: c.name,
    handle: c.instagram_handle,
    igUserId: c.instagram_user_id,
    snapshots: (snaps.data ?? []).filter((s) => s.ig_user_id === c.instagram_user_id),
    posts: (posts.data ?? []).filter((p) => p.ig_user_id === c.instagram_user_id),
  }));

  return NextResponse.json({ ok: true, accounts });
}
