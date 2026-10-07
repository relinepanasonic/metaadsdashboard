import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { cleanTopic } from "@/lib/services/threads";

// The per-brand list of Threads topics that fills the composer's dropdown.
async function staff() {
  const me = await getCurrentUser();
  return me && me.role !== "client" ? me : null;
}

export async function GET(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const clientId = req.nextUrl.searchParams.get("clientId");
  let q = db.from("threads_topics").select("id,client_id,name").order("name");
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: true, topics: [], needsMigration: /threads_topics|schema cache|does not exist/i.test(error.message) });
  return NextResponse.json({ ok: true, topics: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const b = (await req.json().catch(() => ({}))) as { clientId?: string; name?: string };
  const name = cleanTopic(b.name);
  if (!b.clientId || !name) return NextResponse.json({ ok: false, error: "Pick a brand and type a topic." }, { status: 400 });
  const { data, error } = await db.from("threads_topics").insert({ client_id: b.clientId, name }).select("id,client_id,name").single();
  if (error) return NextResponse.json({ ok: false, error: error.code === "23505" ? "That topic is already saved." : /threads_topics|schema cache/i.test(error.message) ? "Run migration 0028 in Supabase first." : error.message }, { status: 400 });
  return NextResponse.json({ ok: true, topic: data });
}

export async function DELETE(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  const { error } = await db.from("threads_topics").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
