import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { verifySiteAccess } from "@/lib/services/searchConsole";

// Retest a GSC connection (after staff adds the service account as a user).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { id } = await params;
  const { data: site, error } = await db.from("search_console_sites").select("site_url").eq("id", id).single();
  if (error || !site) return NextResponse.json({ ok: false, error: "Site not found" }, { status: 404 });
  if (!site.site_url) return NextResponse.json({ ok: false, error: "No Search Console URL set for this site yet." }, { status: 400 });

  try {
    await verifySiteAccess(site.site_url);
    await db.from("search_console_sites").update({ status: "connected", last_error: null, last_synced_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true, status: "connected" });
  } catch (err) {
    const message = (err as Error).message;
    await db.from("search_console_sites").update({ status: "error", last_error: message }).eq("id", id);
    return NextResponse.json({ ok: true, status: "error", error: message });
  }
}

// Edit a site's label, domain, GSC URL, or per-site blog publish target.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { id } = await params;
  const body = (await req.json()) as { label?: string; publish_url?: string; publish_secret?: string; client_id?: string | null };
  const fields: Record<string, string | null> = {};
  if (body.label !== undefined) fields.label = body.label.trim();
  if (body.publish_url !== undefined) fields.publish_url = body.publish_url.trim() || null;
  if (body.publish_secret !== undefined) fields.publish_secret = body.publish_secret.trim() || null;
  if (body.client_id !== undefined) fields.client_id = body.client_id || null;
  if (Object.keys(fields).length === 0) return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });

  const { error } = await db.from("search_console_sites").update(fields).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Remove a website entirely (its saved keywords go with it, via FK cascade).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { id } = await params;
  const { error } = await db.from("search_console_sites").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
