// TikTok safety check. Make reports a TikTok post as done the moment Zernio accepts it, but Zernio can
// still keep it as a draft (no schedule time) or fail it later. This asks Zernio what really happened:
//   published -> the post gets its link, and counts as confirmed
//   draft / failed -> the destination is turned into "failed" with the reason, so it shows in Needs attention
// It needs ZERNIO_API_KEY (Zernio dashboard -> API keys). Without it nothing is checked.

import { db } from "@/lib/supabase/db";

export function zernioConfigured(): boolean {
  return Boolean(process.env.ZERNIO_API_KEY);
}

const API = process.env.ZERNIO_API_BASE || "https://zernio.com/api/v1";
const WAIT_MINUTES = 5; // give Zernio and TikTok time to finish before judging
const GIVE_UP_HOURS = 3; // still not published after this long counts as a failure

interface ZernioPost {
  post?: {
    status?: string;
    platforms?: { platform?: string; status?: string; platformPostUrl?: string; errorMessage?: string; error?: string }[];
  };
}

export interface TiktokVerdict {
  verdict: "confirmed" | "failed" | "waiting";
  url?: string;
  message?: string;
}

// Pure decision from what Zernio says, so it can be tested without a network.
export function judgeZernioPost(body: ZernioPost, publishedAt: Date, now: Date = new Date()): TiktokVerdict {
  const post = body.post;
  const platform = post?.platforms?.find((p) => (p.platform ?? "").toLowerCase() === "tiktok") ?? post?.platforms?.[0];
  const status = (platform?.status ?? post?.status ?? "").toLowerCase();
  const reason = platform?.errorMessage || platform?.error;

  if (status === "published") return { verdict: "confirmed", url: platform?.platformPostUrl };
  if (status === "draft") {
    return { verdict: "failed", message: "Zernio kept this as a DRAFT, so it was NOT posted to TikTok. Publish it from the Zernio dashboard, or check that Make's TikTok module has Scheduled For = publishAt, then press Retry." };
  }
  if (status === "failed" || status === "cancelled" || status === "partial") {
    return { verdict: "failed", message: `Zernio did not publish this to TikTok (${status}${reason ? `: ${reason}` : ""}). Check Zernio, then press Retry.` };
  }
  // scheduled / pending / publishing / unknown: wait, but not forever
  if (now.getTime() - publishedAt.getTime() > GIVE_UP_HOURS * 3600_000) {
    return { verdict: "failed", message: `Still not published by Zernio after ${GIVE_UP_HOURS} hours (status: ${status || "unknown"}). Check Zernio.` };
  }
  return { verdict: "waiting" };
}

export async function verifyTiktokPosts(): Promise<{ checked: number; confirmed: number; failed: number }> {
  const out = { checked: 0, confirmed: 0, failed: 0 };
  if (!db || !zernioConfigured()) return out;
  const now = new Date();

  const { data: targets } = await db
    .from("scheduled_post_targets")
    .select("id,handle,published_id,published_at")
    .eq("platform", "tiktok")
    .eq("status", "published")
    .is("published_url", null)
    .not("published_id", "is", null)
    .gte("published_at", new Date(now.getTime() - 4 * 86_400_000).toISOString())
    .lte("published_at", new Date(now.getTime() - WAIT_MINUTES * 60_000).toISOString())
    .limit(20);

  for (const t of targets ?? []) {
    try {
      const res = await fetch(`${API}/posts/${encodeURIComponent(t.published_id as string)}`, {
        headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` },
        cache: "no-store",
      });
      if (!res.ok) continue; // not found / key problem: leave the card as it is
      out.checked++;
      const v = judgeZernioPost((await res.json()) as ZernioPost, new Date(t.published_at as string), now);
      if (v.verdict === "confirmed") {
        const handle = String(t.handle ?? "").replace(/^@/, "");
        await db.from("scheduled_post_targets").update({ published_url: v.url || `https://www.tiktok.com/@${handle}`, error: null }).eq("id", t.id);
        out.confirmed++;
      } else if (v.verdict === "failed") {
        await db.from("scheduled_post_targets").update({ status: "failed", error: v.message }).eq("id", t.id);
        out.failed++;
      }
    } catch {
      // a network blip is not a verdict; it is checked again next time
    }
  }
  return out;
}
