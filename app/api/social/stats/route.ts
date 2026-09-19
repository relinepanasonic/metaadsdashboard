import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { loadAccounts } from "@/lib/services/socialSync";

// PostgREST caps every response at 1000 rows, and years of daily snapshots
// across many accounts blow past that, so read in pages until exhausted.
async function fetchAll<T>(make: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await make(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}

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
// each with its full stored daily history (up to two years) and recent posts,
// in one shared shape so the page doesn't care which platform they came from.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: true, accounts: [] });

  try {
    const rows = await loadAccounts();
    const igIds = rows.filter((r) => r.account.platform === "instagram").map((r) => r.account.external_id);
    const fbIds = rows.filter((r) => r.account.platform === "facebook").map((r) => r.account.external_id);
    // Two years of history: the page shows month-to-month trends far beyond the
    // 90 days Meta itself will return, because every day is stored here.
    const since = isoDaysAgo(730);
    // Posts are only shown for the recent ranges, so don't drag years of them along.
    const postsSince = `${isoDaysAgo(120)}T00:00:00Z`;

    const [igSnaps, igPosts, fbSnaps, fbPosts] = await Promise.all([
      igIds.length
        ? fetchAll<Snap & { ig_user_id: string }>((f, t) =>
            db!.from("instagram_snapshots").select("ig_user_id,snapshot_date,followers_count,reach,views,profile_views,accounts_engaged,total_interactions").in("ig_user_id", igIds).gte("snapshot_date", since).order("snapshot_date", { ascending: true }).range(f, t)
          )
        : Promise.resolve([] as (Snap & { ig_user_id: string })[]),
      igIds.length
        ? fetchAll<PostOut & { ig_user_id: string }>((f, t) =>
            db!.from("instagram_posts").select("media_id,ig_user_id,caption,media_type,permalink,posted_at,like_count,comments_count").in("ig_user_id", igIds).gte("posted_at", postsSince).order("posted_at", { ascending: false }).range(f, t)
          )
        : Promise.resolve([] as (PostOut & { ig_user_id: string })[]),
      fbIds.length
        ? fetchAll<{ page_id: string; snapshot_date: string; followers_count: number | null }>((f, t) =>
            db!.from("facebook_snapshots").select("page_id,snapshot_date,followers_count").in("page_id", fbIds).gte("snapshot_date", since).order("snapshot_date", { ascending: true }).range(f, t)
          )
        : Promise.resolve([] as { page_id: string; snapshot_date: string; followers_count: number | null }[]),
      fbIds.length
        ? fetchAll<{ post_id: string; page_id: string; message: string | null; permalink: string | null; posted_at: string | null; reactions_count: number | null; comments_count: number | null }>((f, t) =>
            db!.from("facebook_posts").select("post_id,page_id,message,permalink,posted_at,reactions_count,comments_count").in("page_id", fbIds).gte("posted_at", postsSince).order("posted_at", { ascending: false }).range(f, t)
          )
        : Promise.resolve([] as { post_id: string; page_id: string; message: string | null; permalink: string | null; posted_at: string | null; reactions_count: number | null; comments_count: number | null }[]),
    ]);

    const accounts = rows.map(({ account, clientName }) => {
      let snapshots: Snap[];
      let posts: PostOut[];
      if (account.platform === "instagram") {
        snapshots = igSnaps.filter((s) => s.ig_user_id === account.external_id);
        posts = igPosts.filter((p) => p.ig_user_id === account.external_id);
      } else {
        snapshots = fbSnaps
          .filter((s) => s.page_id === account.external_id)
          .map((s) => ({ snapshot_date: s.snapshot_date, followers_count: s.followers_count, reach: null, views: null, profile_views: null, accounts_engaged: null, total_interactions: null }));
        posts = fbPosts
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
