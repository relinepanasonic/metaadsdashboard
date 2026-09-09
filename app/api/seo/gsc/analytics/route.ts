import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchSearchAnalytics, fetchSitemapCoverage } from "@/lib/services/searchConsole";
import { resolveGscTarget } from "@/lib/services/siteResolve";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Real Search Console data for one connected site (or sub-site path): daily
// rows (for the chart) + a monthly rollup (for month-over-month comparison)
// + indexing coverage.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ ok: false, error: "Missing ?siteId=" }, { status: 400 });

  const target = await resolveGscTarget(siteId);
  if (!target) return NextResponse.json({ ok: false, error: "Search Console isn't connected for this site." }, { status: 400 });

  try {
    // Search Console data lags ~2-3 days behind real time.
    const startDate = isoDaysAgo(16 * 30); // ~16 months, GSC's own retention limit
    const endDate = isoDaysAgo(3);

    // Sitemap coverage is a domain-level report — GSC has no per-path
    // breakdown, so sub-sites just don't get an indexing-coverage number.
    const [daily, coverage] = await Promise.all([
      fetchSearchAnalytics(target.siteUrl, startDate, endDate, target.pathPrefix),
      target.pathPrefix ? Promise.resolve({ indexed: 0, notIndexed: 0 }) : fetchSitemapCoverage(target.siteUrl).catch(() => ({ indexed: 0, notIndexed: 0 })),
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

    return NextResponse.json({ ok: true, site: { url: target.siteUrl, label: target.label }, daily, monthly, coverage });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
