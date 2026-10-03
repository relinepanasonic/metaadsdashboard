import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// What this website has received so far, and what is waiting to go out.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ ok: false, error: "siteId is required" }, { status: 400 });

  const [counts, recent, site] = await Promise.all([
    db.from("saved_keywords").select("status").eq("site_id", siteId),
    db.from("saved_keywords").select("keyword,draft_title,published_url,published_at").eq("site_id", siteId).eq("status", "published").order("published_at", { ascending: false }).limit(8),
    db.from("search_console_sites").select("publish_cadence_per_week,last_auto_published_at").eq("id", siteId).maybeSingle(),
  ]);

  const byStatus: Record<string, number> = {};
  for (const r of counts.data ?? []) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

  return NextResponse.json({
    ok: true,
    counts: byStatus,
    recent: recent.data ?? [],
    cadencePerWeek: site.data?.publish_cadence_per_week ?? 0,
    lastAutoPublishedAt: site.data?.last_auto_published_at ?? null,
  });
}
