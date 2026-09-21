import { NextRequest, NextResponse } from "next/server";
import { loadAccounts, syncAccounts } from "@/lib/services/socialSync";
import { syncAllGoogleAccounts } from "@/lib/services/googleAds";

export const maxDuration = 300;

// Daily (see vercel.json): stores the last 7 completed days for every linked
// Instagram account and Facebook Page. A week rather than one day so
// missed runs or late-arriving numbers self-heal; days already stored are
// simply overwritten with the fresher values.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Hobby allows two crons in total, so Google Ads rides along here. The two
    // are independent: a Google failure never blocks the social sync or vice versa.
    const [social, google] = await Promise.allSettled([
      loadAccounts().then((rows) => syncAccounts(rows, 7)),
      syncAllGoogleAccounts(),
    ]);
    return NextResponse.json({
      ok: social.status === "fulfilled",
      results: social.status === "fulfilled" ? social.value : [],
      socialError: social.status === "rejected" ? String(social.reason) : undefined,
      google: google.status === "fulfilled" ? google.value : { error: String(google.reason) },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
