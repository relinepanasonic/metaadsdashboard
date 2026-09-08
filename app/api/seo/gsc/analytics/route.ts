import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchSearchAnalytics, fetchSitemapCoverage } from "@/lib/services/searchConsole";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Real Search Console data for one connected site: daily rows (for the chart)
// + a monthly rollup (for month-over-month comparison) + indexing coverage.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ ok: false, error: "Missing ?siteId=" }, { status: 400 });

  const { data: site, error } = await db.from("search_console_sites").select("site_url,label").eq("id", siteId).single();
  if (error || !site) return NextResponse.json({ ok: false, error: "Site not found" }, { status: 404 });

  try {
    // Search Console data lags ~2-3 days behind real time.
    const startDate = isoDaysAgo(16 * 30); // ~16 months, GSC's own retention limit
    const endDate = isoDaysAgo(3);

    const [daily, coverage] = await Promise.all([
      fetchSearchAnalytics(site.site_url, startDate, endDate),
      fetchSitemapCoverage(site.site_url).catch(() => ({ indexed: 0, notIndexed: 0 })),
    ]);

    // Roll daily rows up into months for the month-over-month view.
    const byMonth = new Map<string, { clicks: number; impressions: number; posSum: number; posCount: number }>();
    for (const r of daily) {
      const month = r.date.slice(0, 7); // YYYY-MM
      const agg = byMonth.get(month) ?? { clicks: 0, impressions: 0, posSum: 0, posCount: 0 };
      agg.clicks += r.clicks;
      agg.impressions += r.impressions;
      agg.posSum += r.position * r.impressions;
      agg.posCount += r.impressions;
      byMonth.set(month, agg);
    }
    const monthly = Array.from(byMonth.entries())
      .map(([month, a]) => ({
        month,
        clicks: Math.round(a.clicks),
        impressions: Math.round(a.impressions),
        avgPosition: a.posCount > 0 ? Math.round((a.posSum / a.posCount) * 10) / 10 : 0,
        ctr: a.impressions > 0 ? Math.round((a.clicks / a.impressions) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    await db.from("search_console_sites").update({ last_synced_at: new Date().toISOString() }).eq("id", siteId);

    return NextResponse.json({ ok: true, site: { url: site.site_url, label: site.label }, daily, monthly, coverage });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
