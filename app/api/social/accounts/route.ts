import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

const ALLOWED = ["founder", "superadmin", "advertiser"];

// Link one more Instagram account or Facebook Page to a client. A client can
// have any number of either; each account can belong to only one client.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !ALLOWED.includes(me.role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { clientId, platform, externalId, handle } = (await req.json()) as {
    clientId?: string;
    platform?: string;
    externalId?: string;
    handle?: string;
  };
  if (!clientId || !externalId?.trim() || (platform !== "instagram" && platform !== "facebook")) {
    return NextResponse.json({ ok: false, error: "Missing clientId, platform (instagram or facebook) or account ID" }, { status: 400 });
  }

  const { data: existing } = await db
    .from("social_accounts")
    .select("id,clients(name)")
    .eq("platform", platform)
    .eq("external_id", externalId.trim())
    .maybeSingle();
  if (existing) {
    const rel = existing.clients as unknown as { name: string } | { name: string }[] | null;
    const owner = Array.isArray(rel) ? rel[0]?.name : rel?.name;
    return NextResponse.json({ ok: false, error: `That account is already linked to ${owner ?? "another client"}.` }, { status: 409 });
  }

  const { data, error } = await db
    .from("social_accounts")
    .insert({ client_id: clientId, platform, external_id: externalId.trim(), handle: handle?.trim() || null })
    .select("id")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
