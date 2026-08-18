import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

// List client roster. `clients` keeps the old bare-name shape (used by
// dropdowns elsewhere); `details` carries the full profile for the Users page.
export async function GET() {
  if (!db) return NextResponse.json({ ok: true, clients: [], details: [] });
  const { data, error } = await db.from("clients").select("name,pic,contact_email").order("name");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    clients: (data ?? []).map((r) => r.name),
    details: data ?? [],
  });
}

// Create or update a client profile (Brand / PIC / Email).
export async function POST(req: NextRequest) {
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  const { name, pic, email } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ ok: false, error: "Missing brand name" }, { status: 400 });
  }
  const { error } = await db.from("clients").upsert(
    { name: name.trim(), pic: pic?.trim() || null, contact_email: email?.trim() || null },
    { onConflict: "name" }
  );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
