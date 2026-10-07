import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { authorizeUrl, signState, threadsConfigured } from "@/lib/services/threads";

// Starts "Connect a Threads account": sends the person to Threads' own login page.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!threadsConfigured()) return NextResponse.json({ ok: false, error: "Set THREADS_APP_ID and THREADS_APP_SECRET in Vercel first (and SCHEDULER_SECRET)." }, { status: 503 });
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ ok: false, error: "clientId is required" }, { status: 400 });

  const redirectUri = `${req.nextUrl.origin}/api/threads/callback`;
  return NextResponse.redirect(authorizeUrl(redirectUri, signState({ clientId })));
}
