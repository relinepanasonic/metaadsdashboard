import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchKeywordIdeas } from "@/lib/services/dataforseo";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const seed = req.nextUrl.searchParams.get("seed");
  if (!seed) return NextResponse.json({ ok: false, error: "Missing ?seed=" }, { status: 400 });

  try {
    const keywords = await fetchKeywordIdeas(seed);
    return NextResponse.json({ ok: true, keywords });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
