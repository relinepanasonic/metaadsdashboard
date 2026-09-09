import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { FIRSTHAND_MARKER } from "@/lib/seo/constants";

export const maxDuration = 120;

// Hands a finished draft to that site's own blog-automation deployment, which
// renders it with the site's template and uploads it over FTP. Each website
// can have its own publish_url/publish_secret (set per-site in Manage
// Websites); BLOG_PUBLISH_URL / BLOG_PUBLISH_SECRET env vars are the fallback
// for a single-site install that hasn't set per-site values yet.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ ok: false, error: "Missing keyword id" }, { status: 400 });

  const { data: row, error: readErr } = await db
    .from("saved_keywords")
    .select("id,keyword,status,site_id,draft_title,draft_slug,draft_meta,draft_excerpt,draft_html,draft_tag")
    .eq("id", id)
    .single();
  if (readErr || !row) return NextResponse.json({ ok: false, error: "Keyword not found" }, { status: 404 });
  if (row.status === "published") {
    return NextResponse.json({ ok: false, error: "Kata kunci ini sudah dipublikasikan." }, { status: 409 });
  }
  if (!row.draft_html || !row.draft_title || !row.draft_slug) {
    return NextResponse.json({ ok: false, error: "Draft belum lengkap." }, { status: 400 });
  }
  if (row.draft_html.includes(FIRSTHAND_MARKER)) {
    return NextResponse.json(
      { ok: false, error: "Bagian \"Dari Pengalaman Kami\" masih placeholder. Isi dulu dengan pengalaman nyata sebelum publish." },
      { status: 400 }
    );
  }

  const { data: site, error: siteErr } = await db
    .from("search_console_sites")
    .select("publish_url,publish_secret,label")
    .eq("id", row.site_id)
    .single();
  if (siteErr || !site) return NextResponse.json({ ok: false, error: "Site not found" }, { status: 404 });

  const endpoint = site.publish_url || process.env.BLOG_PUBLISH_URL;
  const secret = site.publish_secret || process.env.BLOG_PUBLISH_SECRET;
  if (!endpoint || !secret) {
    return NextResponse.json(
      { ok: false, error: `No publish target set for "${site.label}". Set it in Manage Websites, or set BLOG_PUBLISH_URL / BLOG_PUBLISH_SECRET as a fallback.` },
      { status: 500 }
    );
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        title: row.draft_title,
        slug: row.draft_slug,
        metaDescription: row.draft_meta ?? "",
        excerpt: row.draft_excerpt ?? "",
        bodyHtml: row.draft_html,
        tag: row.draft_tag ?? "Optimization",
        language: "id",
      }),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Tidak bisa menghubungi publisher: ${(err as Error).message}` }, { status: 502 });
  }

  const result = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (!res.ok || !result.ok) {
    return NextResponse.json({ ok: false, error: result.error || `Publisher error ${res.status}` }, { status: 502 });
  }

  await db
    .from("saved_keywords")
    .update({ status: "published", published_url: result.url, published_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true, url: result.url });
}
