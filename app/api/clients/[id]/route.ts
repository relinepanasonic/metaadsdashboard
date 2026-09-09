import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { syncClientSite } from "@/lib/services/clientSites";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || !["founder", "superadmin", "advertiser"].includes(me.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { id } = await params;
  const body = (await req.json()) as {
    name?: string;
    owner?: string;
    websiteDomain?: string;
    instagramHandle?: string;
    metaAdAccountId?: string;
    googleAdsAccountId?: string;
  };

  const fields: Record<string, string | null> = {};
  if (body.name !== undefined) fields.name = body.name.trim();
  if (body.owner !== undefined) fields.owner = body.owner.trim() || null;
  if (body.websiteDomain !== undefined) fields.website_domain = body.websiteDomain.trim() || null;
  if (body.instagramHandle !== undefined) fields.instagram_handle = body.instagramHandle.trim() || null;
  if (body.metaAdAccountId !== undefined) fields.meta_ad_account_id = body.metaAdAccountId.trim() || null;
  if (body.googleAdsAccountId !== undefined) fields.google_ads_account_id = body.googleAdsAccountId.trim() || null;
  if (Object.keys(fields).length === 0) return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });

  const { data: client, error } = await db.from("clients").update(fields).eq("id", id).select("id,name,website_domain").single();
  if (error || !client) return NextResponse.json({ ok: false, error: error?.message ?? "Update failed" }, { status: 500 });

  if (body.websiteDomain !== undefined) await syncClientSite(client.id, client.name, client.website_domain);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || !["founder", "superadmin"].includes(me.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { id } = await params;
  await db.from("search_console_sites").update({ client_id: null }).eq("client_id", id);
  const { error } = await db.from("clients").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
