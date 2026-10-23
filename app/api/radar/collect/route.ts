import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { collectAccount } from "@/lib/services/radar";

export const maxDuration = 300;

// COLLECT + RANK: read every watched account's recent Reels from Instagram and score them against that account's usual results.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { accountId?: string; watchId?: string };
  if (!b.accountId) return NextResponse.json({ ok: false, error: "accountId is required" }, { status: 400 });
  try {
    const results = await collectAccount(b.accountId, b.watchId);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
