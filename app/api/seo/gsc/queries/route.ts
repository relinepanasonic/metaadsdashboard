import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchTopQueries } from "@/lib/services/searchConsole";
import { resolveGscTarget } from "@/lib/services/siteResolve";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Real search queries for one connected site (or sub-site path), last 90
// days (Research tab).
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ ok: false, error: "Missing ?siteId=" }, { status: 400 });

  const target = await resolveGscTarget(siteId);
  if (!target) return NextResponse.json({ ok: false, error: "Search Console isn't connected for this site." }, { status: 400 });

  try {
    const startDate = isoDaysAgo(90);
    const endDate = isoDaysAgo(3);
    const queries = await fetchTopQueries(target.siteUrl, startDate, endDate, 250, target.pathPrefix);
    return NextResponse.json({ ok: true, site: { url: target.siteUrl, label: target.label }, queries });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
