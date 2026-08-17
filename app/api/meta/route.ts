import { NextResponse } from "next/server";
import { fetchMetaAdsData } from "@/lib/services/metaAds";

export async function GET() {
  try {
    const data = await fetchMetaAdsData();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
