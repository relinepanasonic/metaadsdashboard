import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { syncInstagramAccount } from "@/lib/services/instagramSync";

export const maxDuration = 300;

// Manual "Sync now" from the Social Media page. Backfills up to 60 days.
// Without a clientId it syncs every client that has an Instagram id set.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { clientId, days } = (await req.json().catch(() => ({}))) as { clientId?: string; days?: number };
  const span = Math.max(1, Math.min(60, Math.round(days ?? 30)));

  let query = db.from("clients").select("id,name,instagram_user_id").not("instagram_user_id", "is", null);
  if (clientId) query = query.eq("id", clientId);
  const { data: clients, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: false, error: "No client has an Instagram account ID set yet. Add one on the Clients page." }, { status: 400 });
  }

  const results = [];
  for (const c of clients) {
    try {
      const r = await syncInstagramAccount(c.instagram_user_id, span);
      results.push({ client: c.name, ...r, errors: [...new Set(r.errors)].slice(0, 3) });
    } catch (err) {
      results.push({ client: c.name, error: (err as Error).message });
    }
  }
  return NextResponse.json({ ok: true, results });
}
