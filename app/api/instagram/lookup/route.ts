import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchProfile } from "@/lib/services/instagram";

// Confirms an Instagram account ID is readable by the token and returns its
// handle. Covers accounts that "Find accounts" can't list because they aren't
// attached to a Facebook Page the token can see.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id || !/^\d{8,25}$/.test(id)) {
    return NextResponse.json({ ok: false, error: "That doesn't look like an Instagram account ID (digits only)." }, { status: 400 });
  }

  try {
    const p = await fetchProfile(id);
    return NextResponse.json({ ok: true, username: p.username, followers: p.followers_count, media: p.media_count });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 200 });
  }
}
