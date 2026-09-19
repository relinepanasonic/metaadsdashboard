import { NextRequest, NextResponse } from "next/server";
import { loadAccounts, syncAccounts } from "@/lib/services/socialSync";

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
    return NextResponse.json({ ok: true, results: await syncAccounts(await loadAccounts(), 7) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
