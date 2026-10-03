import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { classifyPublishResponse, type ConnectionState } from "@/lib/seo/classifyPublish";

export const maxDuration = 30;

// "Test connection": proves the website's publish endpoint is reachable and accepts our secret
// WITHOUT publishing anything. It sends the real secret with an EMPTY body (plus an
// X-Dry-Run header for endpoints that support it). A correctly built endpoint answers
// "400 Missing field" (secret accepted, nothing to publish) or "200 dryRun".
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  const { siteId } = (await req.json().catch(() => ({}))) as { siteId?: string };
  if (!siteId) return NextResponse.json({ ok: false, error: "siteId is required" }, { status: 400 });

  const { data: site } = await db.from("search_console_sites").select("label,publish_url,publish_secret").eq("id", siteId).maybeSingle();
  if (!site) return NextResponse.json({ ok: false, error: "Website not found" }, { status: 404 });

  const endpoint = site.publish_url || process.env.BLOG_PUBLISH_URL;
  const secret = site.publish_secret || process.env.BLOG_PUBLISH_SECRET;
  if (!endpoint || !secret) {
    return NextResponse.json({ ok: true, state: "no-target" satisfies ConnectionState, message: "Add the publish URL and a secret first, then save." });
  }
  if (!/^https:\/\//i.test(endpoint)) {
    return NextResponse.json({ ok: true, state: "unknown" satisfies ConnectionState, message: "The publish URL must start with https://" });
  }

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}`, "X-Dry-Run": "1" },
      body: JSON.stringify({ dryRun: true }),
      signal: AbortSignal.timeout(15_000),
      redirect: "manual", // a redirect to a login or "www" page would silently turn the POST into a GET
    });
  } catch (err) {
    return NextResponse.json({ ok: true, state: "unreachable" satisfies ConnectionState, message: `Could not reach ${new URL(endpoint).host}: ${(err as Error).message}. Check the URL and that the website project is deployed.` });
  }
  const ms = Date.now() - started;
  const type = res.headers.get("content-type") ?? "";
  const text = await res.text().catch(() => "");
  const verdict = classifyPublishResponse({ status: res.status, contentType: type, text, location: res.headers.get("location") });
  return NextResponse.json({ ok: true, state: verdict.state, message: verdict.message, httpStatus: res.status, ms, detail: text.replace(/\s+/g, " ").slice(0, 160) });
}
