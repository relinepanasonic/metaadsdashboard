import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// Recent generations for a client (newest first), without the long prompts.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ ok: false, error: "clientId is required" }, { status: 400 });
  const { data, error } = await db.from("reengine_runs").select("id,source,items,provider,created_by,created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20);
  if (error) return NextResponse.json({ ok: true, runs: [] }); // table not created yet
  const runs = (data ?? []).map((r) => ({
    id: r.id as string,
    createdAt: r.created_at as string,
    createdBy: r.created_by as string | null,
    provider: r.provider as string | null,
    sourceCaption: String((r.source as { caption?: string })?.caption ?? "").slice(0, 120),
    titles: ((r.items as { title?: string }[]) ?? []).map((i) => i.title ?? ""),
  }));
  return NextResponse.json({ ok: true, runs });
}
