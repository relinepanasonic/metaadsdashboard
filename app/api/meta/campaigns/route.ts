import { NextRequest, NextResponse } from "next/server";
import { fetchMetaCampaigns } from "@/lib/services/metaCampaigns";
import { getCurrentUser } from "@/lib/auth/currentUser";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (me.role === "client") return NextResponse.json({ ok: false, error: "Use /api/meta/my-campaigns" }, { status: 403 });

  const account = req.nextUrl.searchParams.get("account");
  if (!account) {
    return NextResponse.json({ ok: false, error: "Missing ?account=<id>" }, { status: 400 });
  }
  if (me.role === "advertiser" && !me.adAccountIds.includes(account)) {
    return NextResponse.json({ ok: false, error: "You don't have access to this ad account." }, { status: 403 });
  }

  const since = req.nextUrl.searchParams.get("since") ?? undefined;
  const until = req.nextUrl.searchParams.get("until") ?? undefined;
  const preset = req.nextUrl.searchParams.get("date_preset") ?? undefined;

  try {
    const campaigns = await fetchMetaCampaigns(account, { since, until, preset });
    return NextResponse.json({ ok: true, campaigns });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
