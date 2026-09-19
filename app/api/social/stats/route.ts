import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { loadAccounts } from "@/lib/services/socialSync";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

interface Snap {
  snapshot_date: string;
  followers_count: number | null;
  reach: number | null;
  views: number | null;
  profile_views: number | null;
  accounts_engaged: number | null;
  total_interactions: number | null;
}

interface PostOut {
  media_id: string;
  caption: string | null;
  media_type: string | null;
  permalink: string | null;
  posted_at: string | null;
  like_count: number | null;
  comments_count: number | null;
}

// Everything the Social Media page needs in one call: one entry per linked
// account (a client can have several Instagram accounts and Facebook Pages),
// each with its stored daily snapshots (last 120 days, enough for a 60-day
// range plus the previous period) and recent posts, in one shared shape so
// the page doesn't care which platform they came from.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: true, accounts: [] });

  try {
    const rows = await loadAccounts();
    const igIds = rows.filter((r) => r.account.platform === "instagram").map((r) => r.account.external_id);
    const fbIds = rows.filter((r) => r.account.platform === "facebook").map((r) => r.account.external_id);
    const since = isoDaysAgo(120);

    const [igSnaps, igPosts, fbSnaps, fbPosts] = await Promise.all([
      igIds.length
        ? db.from("instagram_snapshots").select("ig_user_id,snapshot_date,followers_count,reach,views,profile_views,accounts_engaged,total_interactions").in("ig_user_id", igIds).gte("snapshot_date", since).order("snapshot_date", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      igIds.length
        ? db.from("instagram_posts").select("media_id,ig_user_id,caption,media_type,permalink,posted_at,like_count,comments_count").in("ig_user_id", igIds).order("posted_at", { ascending: false }).limit(300)
        : Promise.resolve({ data: [], error: null }),
      fbIds.length
        ? db.from("facebook_snapshots").select("page_id,snapshot_date,followers_count").in("page_id", fbIds).gte("snapshot_date", since).order("snapshot_date", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      fbIds.length
        ? db.from("facebook_posts").select("post_id,page_id,message,permalink,posted_at,reactions_count,comments_count").in("page_id", fbIds).order("posted_at", { ascending: false }).limit(300)
        : Promise.resolve({ data: [], error: null }),
    ]);
    for (const r of [igSnaps, igPosts, fbSnaps, fbPosts]) if (r.error) throw new Error(r.error.message);

    const accounts = rows.map(({ account, clientName }) => {
      let snapshots: Snap[];
      let posts: PostOut[];
      if (account.platform === "instagram") {
        snapshots = (igSnaps.data ?? []).filter((s) => s.ig_user_id === account.external_id) as unknown as Snap[];
        posts = (igPosts.data ?? []).filter((p) => p.ig_user_id === account.external_id) as unknown as PostOut[];
      } else {
        snapshots = (fbSnaps.data ?? [])
          .filter((s) => s.page_id === account.external_id)
          .map((s) => ({ snapshot_date: s.snapshot_date, followers_count: s.followers_count, reach: null, views: null, profile_views: null, accounts_engaged: null, total_interactions: null }));
        posts = (fbPosts.data ?? [])
          .filter((p) => p.page_id === account.external_id)
          .map((p) => ({ media_id: p.post_id, caption: p.message, media_type: "facebook post", permalink: p.permalink, posted_at: p.posted_at, like_count: p.reactions_count, comments_count: p.comments_count }));
      }
      return {
        accountId: account.id,
        clientId: account.client_id,
        clientName,
        platform: account.platform,
        handle: account.handle,
        externalId: account.external_id,
        snapshots,
        posts,
      };
    });

    return NextResponse.json({ ok: true, accounts });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
