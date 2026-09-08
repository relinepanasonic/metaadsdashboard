import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchCompetitorsDomain } from "@/lib/services/dataforseo";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({ ok: false, error: "Missing ?domain=" }, { status: 400 });

  try {
    const competitors = await fetchCompetitorsDomain(domain);
    return NextResponse.json({ ok: true, competitors });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
