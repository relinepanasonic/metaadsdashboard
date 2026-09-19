import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { syncClientSite } from "@/lib/services/clientSites";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || !["founder", "superadmin", "advertiser"].includes(me.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!db) return NextResponse.json({ ok: true, clients: [] });

  const { data, error } = await db
    .from("clients")
    .select("id,name,owner,pic,contact_email,website_domain,instagram_handle,instagram_user_id,meta_ad_account_id,google_ads_account_id,created_at")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Each client can have several Instagram accounts and Facebook Pages.
  const { data: social } = await db.from("social_accounts").select("id,client_id,platform,external_id,handle").order("created_at");
  const byClient = new Map<string, typeof social>();
  for (const a of social ?? []) byClient.set(a.client_id, [...(byClient.get(a.client_id) ?? []), a]);

  return NextResponse.json({ ok: true, clients: (data ?? []).map((c) => ({ ...c, social: byClient.get(c.id) ?? [] })) });
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !["founder", "superadmin", "advertiser"].includes(me.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const body = (await req.json()) as {
    name?: string;
    owner?: string;
    websiteDomain?: string;
    instagramHandle?: string;
    instagramUserId?: string;
    metaAdAccountId?: string;
    googleAdsAccountId?: string;
  };
  if (!body.name?.trim()) return NextResponse.json({ ok: false, error: "Missing brand name" }, { status: 400 });

  const { data: client, error } = await db
    .from("clients")
    .insert({
      name: body.name.trim(),
      owner: body.owner?.trim() || null,
      website_domain: body.websiteDomain?.trim() || null,
      instagram_handle: body.instagramHandle?.trim() || null,
      instagram_user_id: body.instagramUserId?.trim() || null,
      meta_ad_account_id: body.metaAdAccountId?.trim() || null,
      google_ads_account_id: body.googleAdsAccountId?.trim() || null,
    })
    .select("id,name,website_domain")
    .single();

  if (error || !client) return NextResponse.json({ ok: false, error: error?.message ?? "Failed to create client" }, { status: 500 });

  if (client.website_domain) await syncClientSite(client.id, client.name, client.website_domain);

  return NextResponse.json({ ok: true, id: client.id });
}
