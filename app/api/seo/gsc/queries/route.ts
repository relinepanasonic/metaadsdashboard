import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchTopQueries } from "@/lib/services/searchConsole";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Real search queries for one connected site, last 90 days (Research tab).
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ ok: false, error: "Missing ?siteId=" }, { status: 400 });

  const { data: site, error } = await db.from("search_console_sites").select("site_url,label").eq("id", siteId).single();
  if (error || !site) return NextResponse.json({ ok: false, error: "Site not found" }, { status: 404 });

  try {
    const startDate = isoDaysAgo(90);
    const endDate = isoDaysAgo(3);
    const queries = await fetchTopQueries(site.site_url, startDate, endDate);
    return NextResponse.json({ ok: true, site: { url: site.site_url, label: site.label }, queries });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
