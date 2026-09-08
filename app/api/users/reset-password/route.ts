import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// Superadmin (or Advertiser, for their client users) triggers a password
// reset email for an existing user — the "recreate link" action. A Founder's
// password can only be reset by that same Founder — no one else, ever.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });

  const { data: target } = await db.from("app_users").select("role").eq("email", email).single();
  if (target?.role === "founder" && me.email !== email) {
    return NextResponse.json({ ok: false, error: "Only the Founder can reset their own password." }, { status: 403 });
  }

  const origin = req.nextUrl.origin;
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
