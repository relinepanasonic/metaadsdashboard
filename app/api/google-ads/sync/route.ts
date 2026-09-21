import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { cleanCustomerId, googleConfigured, syncAllGoogleAccounts, syncGoogleAccount } from "@/lib/services/googleAds";

export const maxDuration = 300;

// "Sync now" from the Google Ads page. With a customerId it pulls that one
// account (up to 365 days, for a first backfill); without one it runs the same
// job as the nightly cron.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (me.role === "client") return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
  if (!googleConfigured()) return NextResponse.json({ ok: false, error: "Google Ads is not connected yet." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { customerId?: string; days?: number };
  try {
    if (body.customerId) {
      const days = Math.min(Math.max(Number(body.days) || 30, 1), 365);
      const result = await syncGoogleAccount(cleanCustomerId(body.customerId), days);
      return NextResponse.json({ ok: true, results: [result], failures: [] });
    }
    return NextResponse.json({ ok: true, ...(await syncAllGoogleAccounts()) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
