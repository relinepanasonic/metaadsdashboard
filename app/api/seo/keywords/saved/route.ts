import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// List every saved keyword for one site, newest first.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: true, keywords: [] });

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ ok: false, error: "Missing ?siteId=" }, { status: 400 });

  const { data, error } = await db
    .from("saved_keywords")
    .select("id,keyword,volume,difficulty,cpc_usd,position,source,context,status,draft_title,draft_slug,draft_meta,draft_excerpt,draft_html,draft_tag,published_url,published_at,created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, keywords: data ?? [] });
}

// Save (bookmark) one keyword for later use, scoped to a site. Silently
// no-ops on duplicates (same site + keyword + source + context) via the
// unique constraint.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const body = (await req.json()) as {
    siteId?: string;
    keyword?: string;
    volume?: number;
    difficulty?: number;
    cpcUsd?: number;
    position?: number;
    source?: string;
    context?: string;
  };
  if (!body.siteId || !body.keyword?.trim() || !body.source) {
    return NextResponse.json({ ok: false, error: "Missing siteId, keyword, or source" }, { status: 400 });
  }

  const { data, error } = await db
    .from("saved_keywords")
    .upsert(
      {
        site_id: body.siteId,
        keyword: body.keyword.trim(),
        volume: body.volume ?? null,
        difficulty: body.difficulty ?? null,
        cpc_usd: body.cpcUsd ?? null,
        position: body.position ?? null,
        source: body.source,
        context: body.context ?? null,
        saved_by: me.id,
      },
      { onConflict: "site_id,keyword,source,context" }
    )
    .select("id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
