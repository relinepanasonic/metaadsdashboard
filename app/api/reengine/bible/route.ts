import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import type { SeriesBible } from "@/lib/reengine/types";

async function staff() {
  const me = await getCurrentUser();
  return me && me.role !== "client" ? me : null;
}

const MISSING = /reengine_|schema cache|does not exist/i;

// The Series Bible of one client (null until it is created).
export async function GET(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ ok: false, error: "clientId is required" }, { status: 400 });
  const { data, error } = await db.from("reengine_bibles").select("data,updated_at").eq("client_id", clientId).maybeSingle();
  if (error) return NextResponse.json({ ok: false, needsMigration: MISSING.test(error.message), error: MISSING.test(error.message) ? "Run migration 0030 in Supabase first." : error.message }, { status: 500 });
  return NextResponse.json({ ok: true, bible: (data?.data as SeriesBible | undefined) ?? null, updatedAt: data?.updated_at ?? null });
}

export async function PUT(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const b = (await req.json().catch(() => ({}))) as { clientId?: string; bible?: SeriesBible };
  if (!b.clientId || !b.bible) return NextResponse.json({ ok: false, error: "clientId and bible are required" }, { status: 400 });
  const bible = b.bible;
  if (!bible.host?.trim() || !bible.blocks || !Array.isArray(bible.products) || !Array.isArray(bible.outfits)) {
    return NextResponse.json({ ok: false, error: "The bible is incomplete (host, blocks, outfits and products are required)." }, { status: 400 });
  }
  const { error } = await db.from("reengine_bibles").upsert({ client_id: b.clientId, data: bible, updated_at: new Date().toISOString() }, { onConflict: "client_id" });
  if (error) return NextResponse.json({ ok: false, error: MISSING.test(error.message) ? "Run migration 0030 in Supabase first." : error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
