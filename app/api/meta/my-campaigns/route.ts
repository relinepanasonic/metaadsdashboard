import { NextResponse } from "next/server";
import { fetchCampaignsForClient } from "@/lib/services/metaCampaigns";
import { getCurrentUser } from "@/lib/auth/currentUser";

// For the Client role: their own campaigns, across every account.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "client" || !me.clientName) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const campaigns = await fetchCampaignsForClient(me.clientName);
    return NextResponse.json({ ok: true, campaigns });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
