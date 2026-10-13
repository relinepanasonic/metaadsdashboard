import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { authorizeUrl, redirectUriFor, signState, threadsConfigured } from "@/lib/services/threads";

// Starts "Connect a Threads account": sends the person to Threads' own login page.
// Add &debug=1 to see what would be sent to Threads instead of going there.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!threadsConfigured()) return NextResponse.json({ ok: false, error: "Set THREADS_APP_ID and THREADS_APP_SECRET in Vercel first (and SCHEDULER_SECRET)." }, { status: 503 });
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ ok: false, error: "clientId is required" }, { status: 400 });

  // THREADS_REDIRECT_URI can pin the address if it must match Meta's saved one exactly.
  const redirectUri = redirectUriFor(req.nextUrl.origin);
  const url = authorizeUrl(redirectUri, signState({ clientId }));

  if (req.nextUrl.searchParams.get("debug")) {
    const id = (process.env.THREADS_APP_ID ?? "").trim();
    const secret = process.env.THREADS_APP_SECRET ?? "";
    return NextResponse.json({
      redirectUri,
      appId: id, // an app ID is not secret
      appIdLength: id.length,
      appIdHasSpaceOrQuote: /[\s"']/.test(process.env.THREADS_APP_ID ?? ""),
      secretLength: secret.length,
      secretHasSpaceOrQuote: /[\s"']/.test(secret),
      requestHost: req.headers.get("host"),
      authorizeUrl: url.replace(/state=[^&]+/, "state=…"),
    });
  }
  return NextResponse.redirect(url);
}
