import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/supabase/db";
import { validateImport, type ImportInput } from "@/lib/seo/importValidation";

export const maxDuration = 60;

// Receives a finished blog post from an outside writer (the ERP's AI Office) and stores it in the
// Content Engine as a DRAFT — a person still reviews it, fills in "Dari Pengalaman Kami" and
// presses Publish (or approves it for the weekly drip). Nothing is ever published by this call.
//
//   POST /api/seo/content/import     Authorization: Bearer <CONTENT_INGEST_SECRET>
//   { site: { domain, pathPrefix? }, keyword, title, slug, metaDescription, excerpt, bodyHtml, tag,
//     language: "id", externalId?, mode?: "draft" | "approve", dryRun?: boolean }
//
// Safe to call twice with the same externalId: the draft is updated, never duplicated.

function authorized(req: NextRequest): boolean {
  const secret = process.env.CONTENT_INGEST_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  if (!process.env.CONTENT_INGEST_SECRET) return fail("CONTENT_INGEST_SECRET is not set in Vercel yet.", 503);
  if (!authorized(req)) return fail("Unauthorized", 401);
  if (!db) return fail("Database not configured", 500);

  const body = (await req.json().catch(() => null)) as (Record<string, unknown> & { site?: { domain?: string; pathPrefix?: string | null }; dryRun?: boolean }) | null;
  if (!body || typeof body !== "object") return fail("Send a JSON body.", 400);

  const dryRun = body.dryRun === true || req.headers.get("x-dry-run") === "1";

  // ---- which website --------------------------------------------------------------------
  const domain = String(body.site?.domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!domain) return fail("Missing field: site.domain", 400);
  const prefixRaw = String(body.site?.pathPrefix ?? "").trim();
  const siteKey = prefixRaw ? `${domain}/${prefixRaw.replace(/^\/+|\/+$/g, "")}/` : domain;

  // ---- the post -----------------------------------------------------------------------------
  const checked = validateImport(body as ImportInput);
  if (!checked.ok) return fail(checked.error, 400);
  const post = checked.post;

  const { data: site } = await db.from("search_console_sites").select("id,label,domain").eq("domain", siteKey).maybeSingle();
  if (!site) return fail(`No website "${siteKey}" is set up in this app. Add it under SEO → Manage Websites (or Connect to Website for a sub-website) first.`, 404);

  // ---- duplicates --------------------------------------------------------------------------
  const { data: sameKeyword } = await db
    .from("saved_keywords")
    .select("id,status,source,context")
    .eq("site_id", site.id)
    .ilike("keyword", post.keyword.replace(/[%_]/g, "\\$&"));
  const existing =
    (sameKeyword ?? []).find((k) => k.source === post.source && (k.context ?? "") === (post.externalId || post.keyword)) ?? (sameKeyword ?? [])[0] ?? null;

  if (existing?.status === "published") return fail(`"${post.keyword}" is already published on ${site.label}. Pick another keyword.`, 409);

  const { data: slugTaken } = await db.from("saved_keywords").select("id,keyword").eq("site_id", site.id).eq("draft_slug", post.slug).limit(1);
  if (slugTaken && slugTaken.length > 0 && slugTaken[0].id !== existing?.id) {
    return fail(`The slug "${post.slug}" is already used by another post ("${slugTaken[0].keyword}"). Send a different slug.`, 409);
  }

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, site: site.label, wouldDo: existing ? "update the existing draft" : "create a new draft", slug: post.slug, needsExperience: post.needsExperience });
  }

  // ---- store ----------------------------------------------------------------------------------
  const fields = {
    status: post.mode === "approve" ? "approved" : "drafted",
    ...(post.mode === "approve" ? { approved_at: new Date().toISOString() } : {}),
    draft_title: post.title,
    draft_slug: post.slug,
    draft_meta: post.metaDescription,
    draft_excerpt: post.excerpt,
    draft_html: post.bodyHtml,
    draft_tag: post.tag,
  };

  let id: string;
  if (existing) {
    const { error } = await db.from("saved_keywords").update(fields).eq("id", existing.id);
    if (error) return fail(error.message, 500);
    id = existing.id;
  } else {
    const { data, error } = await db
      .from("saved_keywords")
      .insert({ site_id: site.id, keyword: post.keyword, source: post.source, context: post.externalId || post.keyword, ...fields })
      .select("id")
      .single();
    if (error || !data) return fail(error?.message ?? "Could not save the draft.", 500);
    id = data.id;
  }

  return NextResponse.json({
    ok: true,
    id,
    site: site.label,
    status: fields.status,
    updated: Boolean(existing),
    needsExperience: post.needsExperience,
    reviewUrl: `${req.nextUrl.origin}/seo/content`,
  });
}
