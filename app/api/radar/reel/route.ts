import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { decodedToScript, type Decoded } from "@/lib/radar/decode";

// One collected Reel, shaped for the Re-Engine ("Remix" step): its caption, numbers and decoded structure as a script.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  const { data: r } = await db.from("radar_reels").select("id,account_id,handle,caption,permalink,posted_at,views,likes,comments,outlier,decode").eq("id", id).maybeSingle();
  if (!r) return NextResponse.json({ ok: false, error: "Reel not found" }, { status: 404 });
  const { data: sa } = await db.from("social_accounts").select("client_id").eq("id", r.account_id).maybeSingle();
  return NextResponse.json({
    ok: true,
    reel: {
      id: r.id,
      clientId: sa?.client_id ?? null,
      handle: r.handle,
      caption: r.caption ?? "",
      permalink: r.permalink,
      postedAt: r.posted_at,
      views: r.views,
      likes: r.likes,
      comments: r.comments,
      outlier: r.outlier,
      decoded: Boolean(r.decode),
      script: r.decode ? decodedToScript(r.decode as Decoded) : "",
    },
  });
}
