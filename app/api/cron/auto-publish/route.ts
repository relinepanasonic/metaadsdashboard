import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { publishSavedKeyword, PublishError } from "@/lib/services/publishKeyword";

export const maxDuration = 120;

// Runs hourly (see vercel.json). For every site with an auto-publish cadence
// set, publishes the oldest approved post once enough time has passed since
// that site's last auto-publish — a fixed-cadence drip, FIFO per site.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!db) return NextResponse.json({ ok: true, results: [] });

  const { data: sites, error } = await db
    .from("search_console_sites")
    .select("id,label,publish_cadence_per_week,last_auto_published_at")
    .gt("publish_cadence_per_week", 0);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const results: { site: string; published?: string; skipped?: string; error?: string }[] = [];

  for (const site of sites ?? []) {
    const intervalHours = (7 * 24) / site.publish_cadence_per_week;
    const dueAt = site.last_auto_published_at
      ? new Date(new Date(site.last_auto_published_at).getTime() + intervalHours * 3600_000)
      : new Date(0);
    if (dueAt > new Date()) {
      results.push({ site: site.label, skipped: `not due until ${dueAt.toISOString()}` });
      continue;
    }

    const { data: next, error: qErr } = await db
      .from("saved_keywords")
      .select("id,keyword")
      .eq("site_id", site.id)
      .eq("status", "approved")
      .order("approved_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (qErr) {
      results.push({ site: site.label, error: qErr.message });
      continue;
    }
    if (!next) {
      results.push({ site: site.label, skipped: "queue empty" });
      continue;
    }

    try {
      const { url } = await publishSavedKeyword(next.id);
      await db.from("search_console_sites").update({ last_auto_published_at: new Date().toISOString() }).eq("id", site.id);
      results.push({ site: site.label, published: url });
    } catch (err) {
      const message = err instanceof PublishError ? err.message : (err as Error).message;
      results.push({ site: site.label, error: message });
    }
  }

  return NextResponse.json({ ok: true, results });
}
