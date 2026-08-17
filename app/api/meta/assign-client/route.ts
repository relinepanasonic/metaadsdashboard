import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

// Assign (or clear) a campaign's client. Upserts campaign_clients.
export async function POST(req: NextRequest) {
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { campaignId, accountId, clientName } = await req.json();
  if (!campaignId || !accountId) {
    return NextResponse.json({ ok: false, error: "Missing campaignId or accountId" }, { status: 400 });
  }

  // Empty clientName => remove the override.
  if (!clientName) {
    const { error } = await db.from("campaign_clients").delete().eq("campaign_id", campaignId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await db.from("campaign_clients").upsert(
    { campaign_id: campaignId, ad_account_id: accountId, client_name: clientName, updated_at: new Date().toISOString() },
    { onConflict: "campaign_id" }
  );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Make sure the client exists in the roster.
  await db.from("clients").upsert({ name: clientName }, { onConflict: "name" });

  return NextResponse.json({ ok: true });
}
