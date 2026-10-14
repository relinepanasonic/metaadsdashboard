// "What is due right now": destinations still waiting, whose post's time has come.
//
// This starts from the waiting destinations (always few) and then loads their posts. Starting from the
// posts does not work: a post stays "scheduled" for good after it went out, so the oldest 50 posts are
// soon all finished ones and newer posts never get a look.

import { db } from "@/lib/supabase/db";

export interface DueTarget {
  id: string;
  post_id: string;
  platform: string;
  handle: string | null;
  external_id: string | null;
  attempts: number;
}

export interface DuePost {
  id: string;
  client_id?: string | null;
  caption: string;
  content_type: string;
  media: unknown;
  scheduled_at: string;
  topic?: string | null;
  clients?: unknown;
}

export async function dueTargets(opts: {
  platform?: string; // only this platform
  excludePlatforms?: string[]; // everything except these
  postColumns: string; // columns of the post to load (must include id and scheduled_at)
  now?: Date;
}): Promise<{ targets: DueTarget[]; posts: Map<string, DuePost> }> {
  const empty = { targets: [] as DueTarget[], posts: new Map<string, DuePost>() };
  if (!db) return empty;
  const now = opts.now ?? new Date();

  let q = db.from("scheduled_post_targets").select("id,post_id,platform,handle,external_id,attempts").eq("status", "pending").limit(1000);
  if (opts.platform) q = q.eq("platform", opts.platform);
  if (opts.excludePlatforms?.length) q = q.not("platform", "in", `(${opts.excludePlatforms.join(",")})`);
  const { data: pending, error } = await q;
  if (error) throw new Error(error.message);
  if (!pending?.length) return empty;

  const ids = [...new Set(pending.map((t) => t.post_id as string))];
  const { data: rows, error: pErr } = await db
    .from("scheduled_posts")
    .select(opts.postColumns)
    .in("id", ids)
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString());
  if (pErr) throw new Error(pErr.message);

  const posts = new Map((rows as unknown as DuePost[] ?? []).map((p) => [p.id, p]));
  const targets = (pending as DueTarget[])
    .filter((t) => posts.has(t.post_id))
    .sort((a, b) => Date.parse(posts.get(a.post_id)!.scheduled_at) - Date.parse(posts.get(b.post_id)!.scheduled_at));
  return { targets, posts };
}
