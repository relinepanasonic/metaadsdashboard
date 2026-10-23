import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { runRadarAgent } from "@/lib/services/radar";

export const maxDuration = 300;

// Runs the whole agent now for one account: collect, decode the best new winners, write the brief.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { accountId?: string };
  if (!b.accountId) return NextResponse.json({ ok: false, error: "accountId is required" }, { status: 400 });
  try {
    const reports = await runRadarAgent({ accountId: b.accountId, force: true, budgetMs: 250_000 });
    return NextResponse.json({ ok: true, report: reports[0] ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
