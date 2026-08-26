import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// Bulk-rewrite a set of raw category strings into one canonical name.
// Body: { from: string[], to: string }
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { from, to } = (await req.json()) as { from: string[]; to: string };
  if (!Array.isArray(from) || from.length === 0 || !to?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing from[] or to" }, { status: 400 });
  }

  const target = to.trim();
  const { error, count } = await db
    .from("audience_records")
    .update({ category: target }, { count: "exact" })
    .in("category", from);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: count ?? 0, target });
}
