import { db } from "@/lib/supabase/db";
import { fetchPageBasics, fetchPagePosts } from "./facebook";

export interface FbSyncResult {
  pageId: string;
  name: string;
  postsStored: number;
  errors: string[];
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Stores today's follower count (dated yesterday, like Instagram, so the
// dashboard's completed-days window lines up) and, when the token is allowed
// to read them, the newest posts with reaction/comment counts.
export async function syncFacebookPage(pageId: string): Promise<FbSyncResult> {
  if (!db) throw new Error("Supabase not configured");
  const errors: string[] = [];

  const basics = await fetchPageBasics(pageId); // throws on missing access — caller reports it

  const { error } = await db.from("facebook_snapshots").upsert(
    { page_id: pageId, snapshot_date: isoDaysAgo(1), followers_count: basics.followers_count, fan_count: basics.fan_count },
    { onConflict: "page_id,snapshot_date" }
  );
  if (error) errors.push(`snapshot: ${error.message}`);

  let postsStored = 0;
  try {
    const posts = await fetchPagePosts(pageId);
    if (posts.length > 0) {
      const { error: pErr } = await db.from("facebook_posts").upsert(
        posts.map((p) => ({
          post_id: p.id,
          page_id: pageId,
          message: p.message ?? null,
          permalink: p.permalink_url ?? null,
          posted_at: p.created_time ?? null,
          reactions_count: p.reactions?.summary.total_count ?? null,
          comments_count: p.comments?.summary.total_count ?? null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "post_id" }
      );
      if (pErr) errors.push(`posts: ${pErr.message}`);
      else postsStored = posts.length;
    }
  } catch (err) {
    errors.push(`posts: ${(err as Error).message}`);
  }

  return { pageId, name: basics.name, postsStored, errors };
}
