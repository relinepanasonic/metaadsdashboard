import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { schedulerAuthorized, schedulerConfigured } from "@/lib/services/schedulerAuth";

// Make.com reports what happened to one job it took from /due:
//   { "targetId": "...", "status": "published", "url": "https://…", "platformPostId": "…" }
//   { "targetId": "...", "status": "failed",    "error": "what Instagram said" }
export async function POST(req: NextRequest) {
  if (!schedulerConfigured()) return NextResponse.json({ ok: false, error: "SCHEDULER_SECRET is not set in Vercel yet." }, { status: 503 });
  if (!schedulerAuthorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  // Be forgiving about how Make sends this: JSON, form-encoded, or plain query parameters, whatever
  // Content-Type it claims. A report that is rejected is a job that never finishes, so every reject
  // is also written down (field NAMES only, never values) so it can be diagnosed from the app.
  type Body = { targetId?: string; status?: string; url?: string; platformPostId?: string; error?: string };
  const raw = (await req.text()).trim();
  let body: Body = {};
  if (raw.startsWith("{")) {
    try {
      body = JSON.parse(raw) as Body;
    } catch {
      body = {};
    }
  } else if (raw) {
    body = Object.fromEntries(new URLSearchParams(raw)) as Body;
  }
  // Field names are matched ignoring capitalisation ("targetID" == "targetId"): a typo in Make's
  // field list must not leave a published post stuck.
  const rawKeys = [...Object.keys(body), ...req.nextUrl.searchParams.keys()];
  const merged = new Map<string, string>();
  for (const [k, v] of [...Object.entries(body), ...req.nextUrl.searchParams.entries()]) {
    if (typeof v === "string" && v !== "" && !merged.has(k.toLowerCase())) merged.set(k.toLowerCase(), v);
  }
  body = {
    targetId: merged.get("targetid"),
    status: merged.get("status"),
    url: merged.get("url"),
    platformPostId: merged.get("platformpostid"),
    error: merged.get("error"),
  };
  const targetId = typeof body.targetId === "string" ? body.targetId.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";

  const reject = async (message: string) => {
    await db!.from("scheduler_state").upsert(
      {
        key: "last_result_reject",
        value: JSON.stringify({ at: new Date().toISOString(), message, contentType: req.headers.get("content-type"), bodyLength: raw.length, fields: rawKeys, statusValue: status || null, targetIdLength: targetId.length }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  };
  if (!targetId) return reject("targetId is required");
  if (status !== "published" && status !== "failed") return reject('status must be "published" or "failed"');

  const patch =
    status === "published"
      ? { status: "published", published_at: new Date().toISOString(), published_url: body.url?.slice(0, 500) ?? null, published_id: body.platformPostId?.slice(0, 200) ?? null, error: null }
      : { status: "failed", error: (body.error || "Make reported a failure").slice(0, 500) };

  // Only a job that is still in flight can be updated — a late duplicate report never overwrites a result.
  const { data, error } = await db.from("scheduled_post_targets").update(patch).eq("id", targetId).in("status", ["claimed", "pending"]).select("id");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ ok: true, ignored: true });
  return NextResponse.json({ ok: true });
}
