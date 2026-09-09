import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { verifySiteAccess, explainSiteAccessError, SEARCH_CONSOLE_CONFIGURED } from "@/lib/services/searchConsole";

function bareDomain(input: string): string {
  return input
    .replace(/^sc-domain:/, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .toLowerCase()
    .trim();
}

// List every website registered for SEO tools — hundreds is the design target.
// GSC connection is optional per site: Research, Competitor Analysis, and the
// Content Engine all work from just a domain.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: true, sites: [] });

  const { data, error } = await db
    .from("search_console_sites")
    .select("id,domain,site_url,label,status,last_error,last_synced_at,publish_url,publish_secret,client_id,publish_cadence_per_week,last_auto_published_at,created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sites: data ?? [] });
}

// Register a website. `siteUrl` (the GSC property format) is optional — a site
// can exist purely by domain and get GSC wired up later from the same page.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { domain, siteUrl, label, clientId } = (await req.json()) as { domain?: string; siteUrl?: string; label: string; clientId?: string };
  const rawDomain = domain?.trim() || (siteUrl ? bareDomain(siteUrl) : "");
  if (!rawDomain || !label?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing domain or label" }, { status: 400 });
  }
  const cleanDomain = bareDomain(rawDomain);
  const cleanSiteUrl = siteUrl?.trim() || null;

  // client_id is only included when explicitly passed, so re-upserting an
  // existing site (e.g. wiring up GSC on it) never clobbers its brand link.
  const { data: site, error: insertErr } = await db
    .from("search_console_sites")
    .upsert(
      {
        domain: cleanDomain,
        label: label.trim(),
        site_url: cleanSiteUrl,
        status: cleanSiteUrl ? "pending" : "none",
        connected_by: me.id,
        ...(clientId !== undefined ? { client_id: clientId.trim() || null } : {}),
      },
      { onConflict: "domain" }
    )
    .select("id")
    .single();

  if (insertErr || !site) {
    return NextResponse.json({ ok: false, error: insertErr?.message ?? "Failed to save" }, { status: 500 });
  }

  if (!cleanSiteUrl) {
    return NextResponse.json({ ok: true, id: site.id, status: "none" });
  }
  if (!SEARCH_CONSOLE_CONFIGURED) {
    return NextResponse.json({ ok: true, id: site.id, status: "none", error: "Site saved. Search Console isn't set up yet — ask a Superadmin to configure it before connecting GSC." });
  }

  try {
    await verifySiteAccess(cleanSiteUrl);
    await db.from("search_console_sites").update({ status: "connected", last_error: null, last_synced_at: new Date().toISOString() }).eq("id", site.id);
    return NextResponse.json({ ok: true, id: site.id, status: "connected" });
  } catch (err) {
    const message = (err as Error).message;
    await db.from("search_console_sites").update({ status: "error", last_error: message }).eq("id", site.id);
    return NextResponse.json({
      ok: true, // saved, just not verified yet — UI shows the error inline
      id: site.id,
      status: "error",
      error: explainSiteAccessError(message),
    });
  }
}
