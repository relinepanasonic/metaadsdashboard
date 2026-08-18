import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// Re-activates an expired/revoked invite with a fresh 14-day expiry, keeping
// the same link (so anything already shared/copied still works).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { token } = await params;
  const { error } = await db
    .from("invites")
    .update({ status: "pending", expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() })
    .eq("token", token);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
