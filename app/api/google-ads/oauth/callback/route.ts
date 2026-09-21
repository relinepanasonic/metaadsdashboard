import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasFullAccess } from "@/lib/auth/currentUser";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<body style="margin:0;background:#0b0e14;color:#e2e8f0;font:14px/1.6 system-ui,sans-serif"><main style="max-width:640px;margin:48px auto;padding:0 20px">${body}</main></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

// Step 2: Google sends the user back here with a one-time code. We exchange it
// for a refresh token and show it once so the owner can paste it into Vercel.
// It is never stored in the database or written to logs.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !hasFullAccess(me.role)) return page("Not allowed", "<h2>Founder or Superadmin only</h2>", 403);

  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) {
    return page("Cancelled", `<h2>Google sign-in was cancelled</h2><p>${esc(sp.get("error")!)}</p><p><a style="color:#22d3ee" href="/google-ads">Back to Google Ads</a></p>`, 400);
  }

  const expected = req.cookies.get("gads_oauth_state")?.value;
  if (!expected || expected !== sp.get("state") || !sp.get("code")) {
    return page("Invalid request", "<h2>This sign-in link expired</h2><p>Start again from the Google Ads page.</p>", 400);
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: sp.get("code")!,
      client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
      redirect_uri: `${req.nextUrl.origin}/api/google-ads/oauth/callback`,
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { refresh_token?: string; error?: string; error_description?: string };

  if (!res.ok || !json.refresh_token) {
    const why = json.error_description || json.error || `HTTP ${res.status}`;
    return page(
      "Could not connect",
      `<h2>Google did not return a refresh token</h2><p>${esc(why)}</p><p>If you connected this Google login before, remove the app at <b>myaccount.google.com/permissions</b> and try again.</p>`,
      400
    );
  }

  const out = page(
    "Google Ads connected",
    `<h2 style="margin:0 0 8px">Google sign-in worked</h2>
<p>Copy this value into Vercel → your project → Settings → Environment Variables as <b>GOOGLE_ADS_REFRESH_TOKEN</b>, then redeploy. It is shown only once and is not saved anywhere else.</p>
<textarea readonly onclick="this.select()" style="width:100%;height:120px;background:#111827;color:#a5f3fc;border:1px solid #334155;border-radius:8px;padding:10px;font:12px monospace">${esc(json.refresh_token)}</textarea>
<p style="color:#94a3b8">Treat it like a password — anyone holding it can read your Google Ads data.</p>
<p><a style="color:#22d3ee" href="/google-ads">Back to Google Ads</a></p>`
  );
  out.cookies.delete({ name: "gads_oauth_state", path: "/api/google-ads/oauth" });
  return out;
}
