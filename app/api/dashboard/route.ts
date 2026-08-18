import { NextResponse } from "next/server";
import { getUnifiedDashboardData } from "@/lib/services/dashboard";
import { ACCOUNT_IDS } from "@/lib/services/metaCampaigns";
import { getCurrentUser } from "@/lib/auth/currentUser";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (me.role === "client") {
    return NextResponse.json({ ok: false, error: "Use /api/meta/my-campaigns" }, { status: 403 });
  }

  const accountIds = me.role === "superadmin" ? ACCOUNT_IDS : me.adAccountIds;

  try {
    const data = await getUnifiedDashboardData(accountIds);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
