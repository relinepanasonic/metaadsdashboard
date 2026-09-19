import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchPageBasics } from "@/lib/services/facebook";

// Confirms a Facebook Page ID is readable by the token and returns its name.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id || !/^\d{6,25}$/.test(id)) {
    return NextResponse.json({ ok: false, error: "That doesn't look like a Facebook Page ID (digits only)." }, { status: 400 });
  }

  try {
    const p = await fetchPageBasics(id);
    return NextResponse.json({ ok: true, name: p.name, followers: p.followers_count });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}
