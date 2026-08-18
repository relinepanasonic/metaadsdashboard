import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// Public: fetch invite metadata for the accept page (no auth — the token IS
// the secret). Only exposes what the signup form needs.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { data, error } = await db
    .from("invites")
    .select("token,role,client_name,label,status,expires_at")
    .eq("token", token)
    .single();

  if (error || !data) return NextResponse.json({ ok: false, error: "Invite not found." }, { status: 404 });
  if (data.status !== "pending") return NextResponse.json({ ok: false, error: `This invite has been ${data.status}.` }, { status: 410 });
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ ok: false, error: "This invite link has expired." }, { status: 410 });

  return NextResponse.json({ ok: true, invite: data });
}

// Revoke an invite (Superadmin/Advertiser only).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { token } = await params;
  const { error } = await db.from("invites").update({ status: "revoked" }).eq("token", token);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
