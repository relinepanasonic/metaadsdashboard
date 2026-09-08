import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { verifySiteAccess, SEARCH_CONSOLE_CONFIGURED } from "@/lib/services/searchConsole";

// List connected properties.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: true, sites: [] });

  const { data, error } = await db
    .from("search_console_sites")
    .select("id,site_url,label,status,last_error,last_synced_at,created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sites: data ?? [] });
}

// Connect a new property: save it, then test whether the service account
// actually has access yet (staff may not have added it as a user yet).
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  if (!SEARCH_CONSOLE_CONFIGURED) {
    return NextResponse.json({ ok: false, error: "Search Console service account isn't set up yet. Ask a Superadmin to configure it first." }, { status: 400 });
  }

  const { siteUrl, label } = (await req.json()) as { siteUrl: string; label: string };
  if (!siteUrl?.trim() || !label?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing siteUrl or label" }, { status: 400 });
  }

  const cleanUrl = siteUrl.trim();
  const { data: site, error: insertErr } = await db
    .from("search_console_sites")
    .upsert(
      { site_url: cleanUrl, label: label.trim(), status: "pending", connected_by: me.id },
      { onConflict: "site_url" }
    )
    .select("id")
    .single();

  if (insertErr || !site) {
    return NextResponse.json({ ok: false, error: insertErr?.message ?? "Failed to save" }, { status: 500 });
  }

  try {
    await verifySiteAccess(cleanUrl);
    await db.from("search_console_sites").update({ status: "connected", last_error: null, last_synced_at: new Date().toISOString() }).eq("id", site.id);
    return NextResponse.json({ ok: true, id: site.id, status: "connected" });
  } catch (err) {
    const message = (err as Error).message;
    await db.from("search_console_sites").update({ status: "error", last_error: message }).eq("id", site.id);
    return NextResponse.json({
      ok: true, // saved, just not verified yet — UI shows the error inline
      id: site.id,
      status: "error",
      error: message.includes("403") || message.includes("Forbidden")
        ? "Access denied — make sure you've added our service account as a user on this property in Search Console, then click Retest."
        : message.includes("404")
        ? "Property not found — check the exact URL format matches what's in Search Console (including sc-domain: prefix if used)."
        : message,
    });
  }
}
