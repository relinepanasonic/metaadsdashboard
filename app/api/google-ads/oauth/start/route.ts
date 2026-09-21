import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUser, hasFullAccess } from "@/lib/auth/currentUser";
import { GOOGLE_OAUTH_SCOPE, googleOauthConfigured } from "@/lib/services/googleAds";

// Step 1 of connecting Google Ads: send a Founder / Superadmin to Google's
// consent screen. The callback then shows the refresh token exactly once.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !hasFullAccess(me.role)) return NextResponse.json({ ok: false, error: "Founder or Superadmin only" }, { status: 403 });
  if (!googleOauthConfigured()) {
    return NextResponse.json({ ok: false, error: "Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET in Vercel first." }, { status: 400 });
  }

  const state = randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_ADS_CLIENT_ID!);
  url.searchParams.set("redirect_uri", `${req.nextUrl.origin}/api/google-ads/oauth/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url);
  res.cookies.set("gads_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google-ads/oauth", maxAge: 600 });
  return res;
}
