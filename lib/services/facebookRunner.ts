// Publishes the Facebook Page destinations that are due. Runs whenever Make checks in
// (/api/scheduler/make/due) and from the daily cron, so Facebook needs no Make module.
// Claiming a destination first makes a double run harmless.

import { db } from "@/lib/supabase/db";
import { dueTargets } from "./dueQueue";
import type { MediaItem } from "./scheduler";
import { publishFacebook } from "./facebookPublish";

export async function publishDueFacebook(): Promise<{ published: number; failed: number }> {
  const out = { published: 0, failed: 0 };
  if (!db || !process.env.META_ACCESS_TOKEN) return out;
  const now = new Date();

  const { targets, posts } = await dueTargets({ platform: "facebook", postColumns: "id,caption,content_type,media,scheduled_at", now });

  for (const t of targets) {
    const { data: won } = await db
      .from("scheduled_post_targets")
      .update({ status: "claimed", claimed_at: now.toISOString(), attempts: t.attempts + 1 })
      .eq("id", t.id)
      .eq("status", "pending")
      .select("id");
    if (!won?.length) continue;

    const post = posts.get(t.post_id)!;
    try {
      if (!t.external_id) throw new Error("This Facebook Page has no Page ID — fix it on the Clients page.");
      const result = await publishFacebook(t.external_id, { caption: post.caption ?? "", contentType: post.content_type, media: (post.media ?? []) as MediaItem[] });
      await db
        .from("scheduled_post_targets")
        .update({ status: "published", published_at: new Date().toISOString(), published_id: result.id, published_url: result.url, error: null })
        .eq("id", t.id);
      out.published++;
    } catch (e) {
      await db.from("scheduled_post_targets").update({ status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 500) }).eq("id", t.id);
      out.failed++;
    }
  }
  return out;
}
