import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser, hasFullAccess } from "@/lib/auth/currentUser";

// Removes a user's app access (deletes their app_users row). A Founder
// account can never be deleted through this endpoint — by anyone, including
// other Founders or Superadmins.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { id } = await params;
  if (id === me.id) {
    return NextResponse.json({ ok: false, error: "You can't delete your own account here." }, { status: 400 });
  }

  const { data: target, error: fetchErr } = await db.from("app_users").select("role").eq("id", id).single();
  if (fetchErr || !target) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  if (target.role === "founder") {
    return NextResponse.json({ ok: false, error: "The Founder account cannot be deleted." }, { status: 403 });
  }
  // Advertisers may only manage Client accounts (matches the GET /api/users scope).
  if (me.role === "advertiser" && target.role !== "client") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!hasFullAccess(me.role) && me.role !== "advertiser") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { error } = await db.from("app_users").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
