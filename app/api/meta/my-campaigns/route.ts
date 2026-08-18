import { NextRequest, NextResponse } from "next/server";
import { fetchCampaignsForClient } from "@/lib/services/metaCampaigns";
import { getCurrentUser } from "@/lib/auth/currentUser";

// For the Client role: their own campaigns, across every account.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "client" || !me.clientName) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const since = req.nextUrl.searchParams.get("since") ?? undefined;
  const until = req.nextUrl.searchParams.get("until") ?? undefined;
  const preset = req.nextUrl.searchParams.get("date_preset") ?? undefined;

  try {
    const campaigns = await fetchCampaignsForClient(me.clientName, { since, until, preset });
    return NextResponse.json({ ok: true, campaigns });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
