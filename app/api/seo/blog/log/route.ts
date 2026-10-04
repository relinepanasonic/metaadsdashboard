import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// The Blog Uploader log: every upload attempt to a website (success or failure) and every draft that
// arrived from the AI Office, newest first. Staff only.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  const sp = req.nextUrl.searchParams;
  const siteId = sp.get("siteId");
  const status = sp.get("status"); // success | failed | received
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 100, 1), 300);

  let q = db
    .from("blog_upload_log")
    .select("id,created_at,site_id,site_label,keyword,title,slug,event,status,trigger,by_user,url,http_status,error")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (siteId) q = q.eq("site_id", siteId);
  if (status === "success" || status === "failed" || status === "received") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    const missing = /blog_upload_log|schema cache|does not exist/i.test(error.message);
    return NextResponse.json({ ok: true, rows: [], needsMigration: missing, error: missing ? undefined : error.message });
  }
  return NextResponse.json({ ok: true, rows: data ?? [], needsMigration: false });
}
