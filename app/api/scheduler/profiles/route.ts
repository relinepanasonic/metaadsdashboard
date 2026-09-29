import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// Threads and TikTok accounts a brand can post to. (Instagram and Facebook come
// from the accounts already linked on the Clients page.)
async function staff() {
  const me = await getCurrentUser();
  return me && me.role !== "client" ? me : null;
}

export async function POST(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  const b = (await req.json().catch(() => ({}))) as { clientId?: string; platform?: string; handle?: string };
  const handle = (b.handle ?? "").trim();
  if (!b.clientId || !handle) return NextResponse.json({ ok: false, error: "Pick a brand and enter the account name." }, { status: 400 });
  if (b.platform !== "threads" && b.platform !== "tiktok") return NextResponse.json({ ok: false, error: "Only Threads and TikTok accounts are added here." }, { status: 400 });

  const { data, error } = await db
    .from("publish_profiles")
    .insert({ client_id: b.clientId, platform: b.platform, handle: handle.startsWith("@") ? handle : `@${handle}` })
    .select("id")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.code === "23505" ? "That account is already added." : error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  const { error } = await db.from("publish_profiles").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
