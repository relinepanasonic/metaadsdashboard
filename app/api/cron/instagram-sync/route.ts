import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { syncInstagramAccount } from "@/lib/services/instagramSync";

export const maxDuration = 300;

// Daily (see vercel.json): stores the last 2 completed days for every client
// with an Instagram account, plus fresh follower count and post stats. Two
// days rather than one so a missed run or late-arriving numbers self-heal.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!db) return NextResponse.json({ ok: true, results: [] });

  const { data: clients, error } = await db.from("clients").select("name,instagram_user_id").not("instagram_user_id", "is", null);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const results = [];
  for (const c of clients ?? []) {
    try {
      const r = await syncInstagramAccount(c.instagram_user_id, 2);
      results.push({ client: c.name, days: r.daysStored, posts: r.postsStored, errors: [...new Set(r.errors)].slice(0, 3) });
    } catch (err) {
      results.push({ client: c.name, error: (err as Error).message });
    }
  }
  return NextResponse.json({ ok: true, results });
}
