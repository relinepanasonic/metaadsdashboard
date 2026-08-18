import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// List invites the current user is allowed to see.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: true, invites: [] });

  const { data, error } = await db
    .from("invites")
    .select("token,role,client_name,ad_account_ids,label,status,created_at,expires_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, invites: data });
}

// Create a new invite link. Superadmin can invite advertiser or client.
// Advertiser can only invite client (scoped implicitly — advertisers manage
// clients under their own accounts, enforced by UI + client-name picker).
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { role, clientName, adAccountIds, label } = await req.json();

  if ((role === "advertiser" || role === "superadmin") && me.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "Only Superadmin can invite Advertisers or Superadmins." }, { status: 403 });
  }
  if (role === "client" && !clientName) {
    return NextResponse.json({ ok: false, error: "clientName is required for client invites." }, { status: 400 });
  }
  if (role === "advertiser" && (!adAccountIds || adAccountIds.length === 0)) {
    return NextResponse.json({ ok: false, error: "adAccountIds is required for advertiser invites." }, { status: 400 });
  }

  const { data, error } = await db
    .from("invites")
    .insert({
      role,
      client_name: role === "client" ? clientName : null,
      ad_account_ids: role === "advertiser" ? adAccountIds : null,
      label: label || null,
      created_by: me.id,
    })
    .select("token")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, token: data.token });
}
