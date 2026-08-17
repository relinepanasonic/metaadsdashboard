import { NextResponse } from "next/server";
import { fetchMetaAccounts } from "@/lib/services/metaCampaigns";

export async function GET() {
  try {
    const accounts = await fetchMetaAccounts();
    return NextResponse.json({ ok: true, accounts });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
