import { NextRequest, NextResponse } from "next/server";
import { fetchMetaCampaigns } from "@/lib/services/metaCampaigns";

export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get("account");
  if (!account) {
    return NextResponse.json({ ok: false, error: "Missing ?account=<id>" }, { status: 400 });
  }
  try {
    const campaigns = await fetchMetaCampaigns(account);
    return NextResponse.json({ ok: true, campaigns });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
