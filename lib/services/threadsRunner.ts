// Publishes the Threads destinations that are due. It runs whenever Make.com checks in
// (/api/scheduler/make/due) and from the daily cron as a safety net, so Threads needs no
// Make module at all. Claiming a destination first makes a double run harmless.

import { db } from "@/lib/supabase/db";
import type { MediaItem } from "./scheduler";
import { decryptToken, encryptToken, publishThread, refreshToken, threadsConfigured } from "./threads";

const REFRESH_WITHIN_DAYS = 10;

export async function publishDueThreads(): Promise<{ published: number; failed: number }> {
  const out = { published: 0, failed: 0 };
  if (!db || !threadsConfigured()) return out;
  const now = new Date();

  const { data: posts } = await db
    .from("scheduled_posts")
    .select("id,client_id,caption,content_type,media,topic")
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString())
    .limit(50);
  if (!posts?.length) return out;

  const { data: targets } = await db
    .from("scheduled_post_targets")
    .select("id,post_id,handle,external_id,attempts")
    .in("post_id", posts.map((p) => p.id))
    .eq("platform", "threads")
    .eq("status", "pending");

  for (const t of targets ?? []) {
    const { data: won } = await db
      .from("scheduled_post_targets")
      .update({ status: "claimed", claimed_at: now.toISOString(), attempts: t.attempts + 1 })
      .eq("id", t.id)
      .eq("status", "pending")
      .select("id");
    if (!won?.length) continue;

    const post = posts.find((p) => p.id === t.post_id)!;
    try {
      const { data: profile } = await db
        .from("publish_profiles")
        .select("id,external_id,access_token,token_expires_at")
        .eq("platform", "threads")
        .eq("client_id", post.client_id)
        .eq("handle", t.handle)
        .maybeSingle();
      if (!profile?.access_token || !profile.external_id) throw new Error("This Threads account isn't connected yet — connect it on the Clients page, then press Retry.");

      let token = decryptToken(profile.access_token);
      const expires = profile.token_expires_at ? Date.parse(profile.token_expires_at) : 0;
      if (expires && expires - Date.now() < REFRESH_WITHIN_DAYS * 86_400_000) {
        if (expires < Date.now()) throw new Error("The Threads login has expired — reconnect the account on the Clients page, then press Retry.");
        const fresh = await refreshToken(token).catch(() => null);
        if (fresh) {
          token = fresh.token;
          await db.from("publish_profiles").update({ access_token: encryptToken(fresh.token), token_expires_at: fresh.expiresAt }).eq("id", profile.id);
        }
      }

      const result = await publishThread(profile.external_id, token, {
        caption: post.caption ?? "",
        contentType: post.content_type,
        media: (post.media ?? []) as MediaItem[],
        topic: post.topic,
      });
      await db
        .from("scheduled_post_targets")
        .update({ status: "published", published_at: new Date().toISOString(), published_id: result.id, published_url: result.permalink, error: null })
        .eq("id", t.id);
      out.published++;
    } catch (e) {
      await db.from("scheduled_post_targets").update({ status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 500) }).eq("id", t.id);
      out.failed++;
    }
  }
  return out;
}

// Keeps every connected account's login fresh even if nothing was posted for weeks.
export async function renewThreadsTokens(): Promise<number> {
  if (!db || !threadsConfigured()) return 0;
  const { data } = await db.from("publish_profiles").select("id,access_token,token_expires_at").eq("platform", "threads").not("access_token", "is", null);
  let n = 0;
  for (const p of data ?? []) {
    const expires = p.token_expires_at ? Date.parse(p.token_expires_at) : 0;
    if (!expires || expires - Date.now() > 20 * 86_400_000 || expires < Date.now()) continue;
    try {
      const fresh = await refreshToken(decryptToken(p.access_token));
      await db.from("publish_profiles").update({ access_token: encryptToken(fresh.token), token_expires_at: fresh.expiresAt }).eq("id", p.id);
      n++;
    } catch {
      // leave it; the account shows as expired and can be reconnected
    }
  }
  return n;
}
