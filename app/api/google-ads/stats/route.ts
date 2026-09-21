import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { cleanCustomerId } from "@/lib/services/googleAds";
import { loadGoogleStats } from "@/lib/services/googleAdsStats";

// Everything on the Google Ads page comes from here. Staff pick any synced
// account; a Client user is pinned to the account linked to their own brand
// (Clients page → Google Ads account ID) and can never name another one.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  let customerId = cleanCustomerId(req.nextUrl.searchParams.get("customerId"));

  if (me.role === "client") {
    const { data } = me.clientName
      ? await db.from("clients").select("google_ads_account_id").eq("name", me.clientName).maybeSingle()
      : { data: null };
    customerId = cleanCustomerId(data?.google_ads_account_id);
    if (!customerId) return NextResponse.json({ ok: true, stats: null, reason: "no-account" });
  } else if (!customerId) {
    // Default for staff: the first brand-linked account, else the most recently synced.
    const { data: mapped } = await db.from("clients").select("google_ads_account_id").not("google_ads_account_id", "is", null).limit(1);
    customerId = cleanCustomerId(mapped?.[0]?.google_ads_account_id);
    if (!customerId) {
      const { data: latest } = await db
        .from("google_ads_accounts")
        .select("customer_id")
        .eq("is_manager", false)
        .order("last_synced_at", { ascending: false })
        .limit(1);
      customerId = latest?.[0]?.customer_id ?? "";
    }
    if (!customerId) return NextResponse.json({ ok: true, stats: null, reason: "no-data" });
  }

  const sp = req.nextUrl.searchParams;
  try {
    const stats = await loadGoogleStats(customerId, {
      preset: sp.get("date_preset") ?? undefined,
      since: sp.get("since") ?? undefined,
      until: sp.get("until") ?? undefined,
    });
    if (!stats) return NextResponse.json({ ok: true, stats: null, reason: "not-synced", customerId });
    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
