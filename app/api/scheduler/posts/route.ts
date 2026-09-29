import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { PLATFORMS, validatePost, type ContentType, type MediaItem, type Platform, type TargetInput } from "@/lib/services/scheduler";

async function staff() {
  const me = await getCurrentUser();
  return me && me.role !== "client" ? me : null;
}

export async function GET() {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  const { data, error } = await db
    .from("scheduled_posts")
    .select("id,client_id,caption,content_type,media,scheduled_at,status,created_by,created_at,clients(name),scheduled_post_targets(id,platform,handle,external_id,status,attempts,published_at,published_url,error)")
    .order("scheduled_at", { ascending: false })
    .limit(300);
  if (error) {
    const missing = /scheduled_posts|schema cache|does not exist/i.test(error.message);
    return NextResponse.json({ ok: false, error: missing ? "The scheduler tables don't exist yet — run migration 0024 in Supabase." : error.message, needsMigration: missing }, { status: 500 });
  }

  const posts = (data ?? []).map((p) => {
    const rel = p.clients as unknown as { name: string } | { name: string }[] | null;
    return {
      id: p.id,
      clientId: p.client_id,
      clientName: Array.isArray(rel) ? rel[0]?.name ?? null : rel?.name ?? null,
      caption: p.caption,
      contentType: p.content_type,
      media: p.media,
      scheduledAt: p.scheduled_at,
      status: p.status,
      createdBy: p.created_by,
      targets: p.scheduled_post_targets ?? [],
    };
  });
  return NextResponse.json({ ok: true, posts });
}

interface Body {
  clientId?: string | null;
  caption?: string;
  contentType?: ContentType;
  media?: MediaItem[];
  scheduledAt?: string;
  status?: "draft" | "scheduled";
  targets?: TargetInput[];
}

export async function POST(req: NextRequest) {
  const me = await staff();
  if (!me) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  const b = (await req.json().catch(() => ({}))) as Body;
  const caption = (b.caption ?? "").trim();
  const media = Array.isArray(b.media) ? b.media.filter((m) => m && typeof m.url === "string" && (m.kind === "image" || m.kind === "video")) : [];
  const targets = (Array.isArray(b.targets) ? b.targets : []).filter((t) => PLATFORMS.includes(t.platform as Platform));
  const contentType = (b.contentType ?? "reel") as ContentType;
  const status = b.status === "draft" ? "draft" : "scheduled";

  const when = b.scheduledAt ? new Date(b.scheduledAt) : null;
  if (!when || Number.isNaN(when.getTime())) return NextResponse.json({ ok: false, error: "Pick a date and time." }, { status: 400 });

  const problem = status === "draft" ? null : validatePost({ contentType, media, caption, targets });
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });

  const { data: post, error } = await db
    .from("scheduled_posts")
    .insert({ client_id: b.clientId || null, caption, content_type: contentType, media, scheduled_at: when.toISOString(), status, created_by: me.username })
    .select("id")
    .single();
  if (error || !post) return NextResponse.json({ ok: false, error: error?.message ?? "Could not save the post." }, { status: 500 });

  if (targets.length > 0) {
    const { error: tErr } = await db.from("scheduled_post_targets").insert(
      targets.map((t) => ({ post_id: post.id, platform: t.platform, handle: t.handle ?? null, external_id: t.externalId ?? null }))
    );
    if (tErr) {
      await db.from("scheduled_posts").delete().eq("id", post.id);
      return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, id: post.id });
}
