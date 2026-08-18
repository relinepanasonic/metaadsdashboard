import { NextResponse } from "next/server";
import { fetchMetaAccounts } from "@/lib/services/metaCampaigns";
import { getCurrentUser } from "@/lib/auth/currentUser";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  try {
    let accounts = await fetchMetaAccounts();
    if (me.role === "advertiser") {
      accounts = accounts.filter((a) => me.adAccountIds.includes(a.id));
    } else if (me.role === "client") {
      accounts = []; // clients use /api/meta/my-campaigns instead
    }
    return NextResponse.json({ ok: true, accounts });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
