import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

// Tells /setup whether bootstrap is still available.
export async function GET() {
  if (!db) return NextResponse.json({ needsSetup: false });
  const { count } = await db.from("app_users").select("id", { count: "exact", head: true });
  return NextResponse.json({ needsSetup: !count || count === 0 });
}

// Creates the very FIRST Superadmin account. Only works while app_users is
// empty — after that, all accounts must come through an invite link.
export async function POST(req: NextRequest) {
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { count } = await db.from("app_users").select("id", { count: "exact", head: true });
  if (count && count > 0) {
    return NextResponse.json({ ok: false, error: "Setup already completed." }, { status: 403 });
  }

  const { username, email, password } = await req.json();
  if (!username || !email || !password) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const { data: signUpData, error: signUpError } = await db.auth.signUp({ email, password });
  if (signUpError || !signUpData.user) {
    return NextResponse.json({ ok: false, error: signUpError?.message ?? "Sign up failed" }, { status: 400 });
  }

  const { error: insertError } = await db.from("app_users").insert({
    id: signUpData.user.id,
    username,
    email,
    role: "superadmin",
  });
  if (insertError) {
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
