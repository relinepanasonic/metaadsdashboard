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

// Rename a client (delete old name, insert new — name is the primary key).
export async function PATCH(req: NextRequest) {
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  const { originalName, name, pic, email } = await req.json();
  if (!originalName || !name) {
    return NextResponse.json({ ok: false, error: "Missing originalName or name" }, { status: 400 });
  }
  if (originalName !== name) {
    await db.from("clients").delete().eq("name", originalName);
  }
  const { error } = await db.from("clients").upsert(
    { name: name.trim(), pic: pic?.trim() || null, contact_email: email?.trim() || null },
    { onConflict: "name" }
  );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Delete a client from the roster.
export async function DELETE(req: NextRequest) {
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ ok: false, error: "Missing ?name=" }, { status: 400 });
  const { error } = await db.from("clients").delete().eq("name", name);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
