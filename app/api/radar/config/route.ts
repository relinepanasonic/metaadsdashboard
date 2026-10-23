import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// The niche description and the weekly-agent switch of one of our Instagram accounts.
export async function PUT(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const b = (await req.json().catch(() => ({}))) as { accountId?: string; niche?: string; auto?: boolean };
  if (!b.accountId) return NextResponse.json({ ok: false, error: "accountId is required" }, { status: 400 });
  const row: Record<string, unknown> = { account_id: b.accountId, updated_at: new Date().toISOString() };
  if (b.niche !== undefined) row.niche = b.niche.trim().slice(0, 500) || null;
  if (b.auto !== undefined) row.auto = Boolean(b.auto);
  const { error } = await db.from("radar_accounts").upsert(row, { onConflict: "account_id" });
  if (error) return NextResponse.json({ ok: false, error: /radar_|schema cache/i.test(error.message) ? "Run migration 0031 in Supabase first." : error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
