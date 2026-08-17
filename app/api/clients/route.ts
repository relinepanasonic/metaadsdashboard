import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

// List client roster.
export async function GET() {
  if (!db) return NextResponse.json({ ok: true, clients: [] });
  const { data, error } = await db.from("clients").select("name").order("name");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, clients: (data ?? []).map((r) => r.name) });
}

// Add a new client name.
export async function POST(req: NextRequest) {
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  const { name } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
  }
  const { error } = await db.from("clients").upsert({ name: name.trim() }, { onConflict: "name" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
