import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { decodeReel } from "@/lib/services/radar";

export const maxDuration = 120;

// DECODE: why did this Reel win? Structure, hook formula, first 3 seconds, pattern.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { reelId?: string };
  if (!b.reelId) return NextResponse.json({ ok: false, error: "reelId is required" }, { status: 400 });
  const r = await decodeReel(b.reelId);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
