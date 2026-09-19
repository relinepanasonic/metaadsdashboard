import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { loadAccounts, syncAccounts } from "@/lib/services/socialSync";

export const maxDuration = 300;

// Manual "Sync now" from the Social Media page. Instagram backfills up to 90
// days. Without a clientId it syncs every linked account, otherwise just that
// client's Instagram accounts and Facebook Pages.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { clientId, days } = (await req.json().catch(() => ({}))) as { clientId?: string; days?: number };
  const span = Math.max(1, Math.min(90, Math.round(days ?? 30)));

  try {
    const rows = await loadAccounts(clientId);
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "No Instagram or Facebook accounts are linked yet. Add them on the Clients page." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, results: await syncAccounts(rows, span) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
