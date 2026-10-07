import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { cleanTopic } from "@/lib/services/threads";
import { PLATFORMS, validatePost, type ContentType, type MediaItem, type Platform, type TargetInput } from "@/lib/services/scheduler";

async function staff() {
  const me = await getCurrentUser();
  return me && me.role !== "client" ? me : null;
}

interface Body {
  action?: "cancel" | "publish_now" | "retry" | "schedule";
  targetId?: string;
  // full edit
  clientId?: string | null;
  caption?: string;
  contentType?: ContentType;
  media?: MediaItem[];
  scheduledAt?: string;
  status?: "draft" | "scheduled";
  targets?: TargetInput[];
  topic?: string | null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Body;
  const nowIso = new Date().toISOString();

  const { data: targets } = await db.from("scheduled_post_targets").select("id,status").eq("post_id", id);

  if (b.action === "cancel") {
    await db.from("scheduled_posts").update({ status: "cancelled", updated_at: nowIso }).eq("id", id);
    await db.from("scheduled_post_targets").update({ status: "cancelled" }).eq("post_id", id).eq("status", "pending");
    return NextResponse.json({ ok: true });
  }

  if (b.action === "publish_now" || b.action === "schedule") {
    const patch: Record<string, unknown> = { status: "scheduled", updated_at: nowIso };
    if (b.action === "publish_now") patch.scheduled_at = nowIso;
    await db.from("scheduled_posts").update(patch).eq("id", id);
    // a cancelled post being revived gets its cancelled destinations back in the queue
    await db.from("scheduled_post_targets").update({ status: "pending" }).eq("post_id", id).eq("status", "cancelled");
    return NextResponse.json({ ok: true });
  }

  if (b.action === "retry") {
    let q = db.from("scheduled_post_targets").update({ status: "pending", attempts: 0, claimed_at: null, error: null }).eq("post_id", id).eq("status", "failed");
    if (b.targetId) q = q.eq("id", b.targetId);
    const { error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    // retry means "post it again now"
    await db.from("scheduled_posts").update({ status: "scheduled", scheduled_at: nowIso, updated_at: nowIso }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  // ---- full edit ----------------------------------------------------------
  if ((targets ?? []).some((t) => t.status === "published" || t.status === "claimed")) {
    return NextResponse.json({ ok: false, error: "This post is already being published or has been published, so it can't be edited." }, { status: 409 });
  }
  const caption = (b.caption ?? "").trim();
  const media = Array.isArray(b.media) ? b.media.filter((m) => m && typeof m.url === "string" && (m.kind === "image" || m.kind === "video")) : [];
  const newTargets = (Array.isArray(b.targets) ? b.targets : []).filter((t) => PLATFORMS.includes(t.platform as Platform));
  const contentType = (b.contentType ?? "reel") as ContentType;
  const status = b.status === "draft" ? "draft" : "scheduled";
  const when = b.scheduledAt ? new Date(b.scheduledAt) : null;
  if (!when || Number.isNaN(when.getTime())) return NextResponse.json({ ok: false, error: "Pick a date and time." }, { status: 400 });
  const problem = status === "draft" ? null : validatePost({ contentType, media, caption, targets: newTargets });
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });

  const { error } = await db
    .from("scheduled_posts")
    .update({ client_id: b.clientId || null, caption, content_type: contentType, media, scheduled_at: when.toISOString(), status, updated_at: nowIso, ...(newTargets.some((t) => t.platform === "threads") ? { topic: cleanTopic(b.topic) } : {}) })
    .eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await db.from("scheduled_post_targets").delete().eq("post_id", id);
  if (newTargets.length > 0) {
    const { error: tErr } = await db.from("scheduled_post_targets").insert(newTargets.map((t) => ({ post_id: id, platform: t.platform, handle: t.handle ?? null, external_id: t.externalId ?? null })));
    if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const { id } = await params;

  const [{ data: post }, { data: targets }] = await Promise.all([
    db.from("scheduled_posts").select("media").eq("id", id).maybeSingle(),
    db.from("scheduled_post_targets").select("status").eq("post_id", id),
  ]);

  const { error } = await db.from("scheduled_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Free the storage space — unless it already went out, where the file is the record of what was posted.
  if (post && !(targets ?? []).some((t) => t.status === "published")) {
    // A duplicated post shares its files with the original, so only remove files no other post uses.
    const { data: others } = await db.from("scheduled_posts").select("media");
    const stillUsed = new Set(((others ?? []) as { media: MediaItem[] | null }[]).flatMap((o) => (o.media ?? []).map((m) => m.url)));
    const paths = ((post.media ?? []) as MediaItem[])
      .filter((m) => !stillUsed.has(m.url))
      .map((m) => m.url.split("/social-media/")[1])
      .filter(Boolean)
      .map((p) => decodeURIComponent(p));
    if (paths.length > 0) await db.storage.from("social-media").remove(paths).catch(() => null);
  }
  return NextResponse.json({ ok: true });
}
