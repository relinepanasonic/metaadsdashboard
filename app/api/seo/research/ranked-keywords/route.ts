import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchRankedKeywords } from "@/lib/services/dataforseo";

// All real keywords a domain (yours or a competitor's) ranks for.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({ ok: false, error: "Missing ?domain=" }, { status: 400 });

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;

  try {
    const keywords = await fetchRankedKeywords(domain, limit);
    return NextResponse.json({ ok: true, domain, keywords });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
