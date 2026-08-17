import { NextResponse } from "next/server";
import { fetchGoogleAdsData } from "@/lib/services/googleAds";

export async function GET() {
  try {
    const data = await fetchGoogleAdsData();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
