import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// Makes a fresh shared secret for a website and stores it. The website must be given the same
// value (as PUBLISH_SECRET), so this replaces any old one — the old one stops working.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  const { siteId } = (await req.json().catch(() => ({}))) as { siteId?: string };
  if (!siteId) return NextResponse.json({ ok: false, error: "siteId is required" }, { status: 400 });

  const secret = randomBytes(32).toString("base64url"); // 43 URL-safe characters
  const { data, error } = await db.from("search_console_sites").update({ publish_secret: secret }).eq("id", siteId).select("id");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ ok: false, error: "Website not found" }, { status: 404 });
  return NextResponse.json({ ok: true, secret });
}
