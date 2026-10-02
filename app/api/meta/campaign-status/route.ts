import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser, hasFullAccess } from "@/lib/auth/currentUser";
import { ACCOUNT_IDS, fetchCampaignInfo, setCampaignStatus } from "@/lib/services/metaCampaigns";

// Switch a Meta campaign on (ACTIVE) or off (PAUSED) from the Meta Ads page.
// This spends or stops real money, so:
//  - clients can never do it;
//  - the campaign's REAL ad account is read from Meta and checked against what this user may
//    manage (the account id the browser sends is never trusted);
//  - only ACTIVE <-> PAUSED is allowed (archived / deleted campaigns are left alone);
//  - every change is written to campaign_status_log (best effort) with who did it.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (me.role === "client") return NextResponse.json({ ok: false, error: "Your login can view campaigns but not change them." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { campaignId?: string; status?: string };
  const campaignId = (body.campaignId ?? "").trim();
  const wanted = body.status === "ACTIVE" || body.status === "PAUSED" ? body.status : null;
  if (!/^\d+$/.test(campaignId) || !wanted) return NextResponse.json({ ok: false, error: "Send a campaignId and a status of ACTIVE or PAUSED." }, { status: 400 });

  try {
    const before = await fetchCampaignInfo(campaignId);

    const allowed = hasFullAccess(me.role) ? ACCOUNT_IDS : me.adAccountIds;
    if (!allowed.includes(before.accountId)) {
      return NextResponse.json({ ok: false, error: "You don't have access to this campaign's ad account." }, { status: 403 });
    }
    if (before.status !== "ACTIVE" && before.status !== "PAUSED") {
      return NextResponse.json({ ok: false, error: `This campaign is ${before.status.toLowerCase()} and can't be switched here.` }, { status: 409 });
    }

    if (before.status !== wanted) {
      await setCampaignStatus(campaignId, wanted);
      if (db) {
        await db
          .from("campaign_status_log")
          .insert({ campaign_id: campaignId, campaign_name: before.name, ad_account_id: before.accountId, from_status: before.status, to_status: wanted, changed_by: me.username })
          .then(() => null, () => null); // table is optional (migration 0026)
      }
    }

    const after = await fetchCampaignInfo(campaignId);
    return NextResponse.json({ ok: true, status: after.status, effectiveStatus: after.effectiveStatus, changed: before.status !== wanted });
  } catch (err) {
    const msg = (err as Error).message;
    const friendly = /code (10|200|294)\b|permission/i.test(msg)
      ? `Meta refused: this token isn't allowed to change that ad account (${msg}). Check that the system user has full control of the ad account in Business Settings.`
      : msg;
    return NextResponse.json({ ok: false, error: friendly }, { status: 500 });
  }
}
