import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

// Resolves a username to its email so /login can accept either.
export async function POST(req: NextRequest) {
  const { username } = await req.json();
  if (!username || !db) return NextResponse.json({ ok: false }, { status: 404 });

  const { data } = await db
    .from("app_users")
    .select("email")
    .ilike("username", username)
    .single();

  if (!data) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, email: data.email });
}
