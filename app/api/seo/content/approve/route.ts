import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { FIRSTHAND_MARKER } from "@/lib/seo/constants";

// Queues a finished draft into its site's auto-publish drip — the cron
// publishes approved posts in FIFO order as each site's cadence allows.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ ok: false, error: "Missing keyword id" }, { status: 400 });

  const { data: row, error: readErr } = await db.from("saved_keywords").select("status,draft_html").eq("id", id).single();
  if (readErr || !row) return NextResponse.json({ ok: false, error: "Keyword not found" }, { status: 404 });
  if (row.status !== "drafted") {
    return NextResponse.json({ ok: false, error: "Only a finished draft can be approved for auto-publish." }, { status: 409 });
  }
  if (!row.draft_html || row.draft_html.includes(FIRSTHAND_MARKER)) {
    return NextResponse.json({ ok: false, error: 'Fill in "Dari Pengalaman Kami" before approving.' }, { status: 400 });
  }

  const { error } = await db.from("saved_keywords").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Un-approves back to a plain draft (removes it from the queue).
export async function DELETE(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ ok: false, error: "Missing keyword id" }, { status: 400 });

  const { error } = await db.from("saved_keywords").update({ status: "drafted", approved_at: null }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
