import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// Every saved keyword for one site plus its draft/publish state — the
// Content Engine board.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: true, items: [] });

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ ok: false, error: "Missing ?siteId=" }, { status: 400 });

  const { data, error } = await db
    .from("saved_keywords")
    .select("id,keyword,volume,status,draft_title,draft_slug,draft_meta,draft_excerpt,draft_html,draft_tag,published_url,published_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

// Saves edits the user made to a draft before publishing.
export async function PATCH(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const body = (await req.json()) as {
    id?: string;
    draft_title?: string;
    draft_slug?: string;
    draft_meta?: string;
    draft_excerpt?: string;
    draft_html?: string;
    draft_tag?: string;
  };
  if (!body.id) return NextResponse.json({ ok: false, error: "Missing keyword id" }, { status: 400 });

  const { id, ...fields } = body;
  const { error } = await db.from("saved_keywords").update(fields).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
