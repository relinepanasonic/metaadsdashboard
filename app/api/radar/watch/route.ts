import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { normHandle } from "@/lib/radar/rank";

async function staff() {
  const me = await getCurrentUser();
  return me && me.role !== "client" ? me : null;
}

// Add a niche account to one of our accounts' watchlists.
export async function POST(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const b = (await req.json().catch(() => ({}))) as { accountId?: string; handle?: string; note?: string };
  const handle = normHandle(b.handle ?? "");
  if (!b.accountId) return NextResponse.json({ ok: false, error: "accountId is required" }, { status: 400 });
  if (!handle) return NextResponse.json({ ok: false, error: "That doesn't look like an Instagram username." }, { status: 400 });
  const { data: sa } = await db.from("social_accounts").select("handle").eq("id", b.accountId).maybeSingle();
  if (sa?.handle && sa.handle.replace(/^@/, "").toLowerCase() === handle) return NextResponse.json({ ok: false, error: "That is your own account." }, { status: 400 });
  const { data, error } = await db.from("radar_watch").insert({ account_id: b.accountId, handle, note: b.note?.trim() || null }).select("id").single();
  if (error) return NextResponse.json({ ok: false, error: error.code === "23505" ? "Already on the watchlist." : /radar_|schema cache/i.test(error.message) ? "Run migration 0031 in Supabase first." : error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  const { error } = await db.from("radar_watch").delete().eq("id", id); // its collected Reels go with it
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
