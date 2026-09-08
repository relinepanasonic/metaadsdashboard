import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchDomainRankOverview, fetchKeywordGap } from "@/lib/services/dataforseo";

// Head-to-head: your domain vs a competitor's — organic footprint overview
// plus the real keyword gap (what they rank for that you don't).
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const yours = req.nextUrl.searchParams.get("yours");
  const competitor = req.nextUrl.searchParams.get("competitor");
  if (!yours || !competitor) return NextResponse.json({ ok: false, error: "Missing ?yours= and ?competitor=" }, { status: 400 });

  try {
    const [yourOverview, competitorOverview, gap] = await Promise.all([
      fetchDomainRankOverview(yours),
      fetchDomainRankOverview(competitor),
      fetchKeywordGap(yours, competitor),
    ]);
    return NextResponse.json({ ok: true, yourOverview, competitorOverview, gap });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
