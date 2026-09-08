import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// List every saved keyword, newest first.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: true, keywords: [] });

  const { data, error } = await db
    .from("saved_keywords")
    .select("id,keyword,volume,difficulty,cpc_usd,position,source,context,created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, keywords: data ?? [] });
}

// Save (bookmark) one keyword for later use. Silently no-ops on duplicates
// (same keyword + source + context) via the unique constraint.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const body = (await req.json()) as {
    keyword?: string;
    volume?: number;
    difficulty?: number;
    cpcUsd?: number;
    position?: number;
    source?: string;
    context?: string;
  };
  if (!body.keyword?.trim() || !body.source) {
    return NextResponse.json({ ok: false, error: "Missing keyword or source" }, { status: 400 });
  }

  const { data, error } = await db
    .from("saved_keywords")
    .upsert(
      {
        keyword: body.keyword.trim(),
        volume: body.volume ?? null,
        difficulty: body.difficulty ?? null,
        cpc_usd: body.cpcUsd ?? null,
        position: body.position ?? null,
        source: body.source,
        context: body.context ?? null,
        saved_by: me.id,
      },
      { onConflict: "keyword,source,context" }
    )
    .select("id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
