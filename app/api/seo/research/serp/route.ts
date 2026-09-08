import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchSerpTop10 } from "@/lib/services/dataforseo";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const keyword = req.nextUrl.searchParams.get("keyword");
  if (!keyword) return NextResponse.json({ ok: false, error: "Missing ?keyword=" }, { status: 400 });

  try {
    const results = await fetchSerpTop10(keyword);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
