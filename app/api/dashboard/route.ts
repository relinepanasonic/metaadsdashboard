import { NextRequest, NextResponse } from "next/server";
import { getUnifiedDashboardData, type Platform } from "@/lib/services/dashboard";
import { ACCOUNT_IDS } from "@/lib/services/metaCampaigns";
import { getCurrentUser } from "@/lib/auth/currentUser";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (me.role === "client") {
    return NextResponse.json({ ok: false, error: "Use /api/meta/my-campaigns" }, { status: 403 });
  }

  const permitted = me.role === "superadmin" ? ACCOUNT_IDS : me.adAccountIds;

  // Optional ?accounts=id1,id2 narrows the permitted set further (e.g. a
  // Business filter on the frontend). Anything outside `permitted` is dropped.
  const requested = req.nextUrl.searchParams.get("accounts");
  const accountIds = requested
    ? requested.split(",").map((s) => s.trim()).filter((id) => permitted.includes(id))
    : permitted;

  const since = req.nextUrl.searchParams.get("since") ?? undefined;
  const until = req.nextUrl.searchParams.get("until") ?? undefined;
  const preset = req.nextUrl.searchParams.get("date_preset") ?? undefined;
  const clientFilter = req.nextUrl.searchParams.get("client") ?? undefined;
  const platform = (req.nextUrl.searchParams.get("platform") as Platform | null) ?? "both";

  try {
    const data = await getUnifiedDashboardData({
      accountIds,
      range: { since, until, preset },
      clientFilter,
      platform,
    });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
