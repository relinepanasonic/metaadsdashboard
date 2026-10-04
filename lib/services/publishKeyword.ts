import { db } from "@/lib/supabase/db";
import { FIRSTHAND_MARKER } from "@/lib/seo/constants";
import { logBlogEvent } from "./blogLog";

export class PublishError extends Error {}

export interface PublishOptions {
  trigger?: "manual" | "auto"; // who started it, for the Blog Uploader log
  by?: string; // username of the person who pressed Publish (manual uploads)
}

// What we know about this upload by the time it succeeds or fails, so the log line is complete either way.
interface LogContext {
  site_id?: string;
  site_label?: string;
  keyword_id?: string;
  keyword?: string;
  title?: string;
  slug?: string;
  httpStatus?: number;
}

// Hands a finished draft to that site's own blog-automation deployment, which
// renders it with the site's template and uploads it over FTP. Shared by the
// manual "Publish now" route and the auto-publish cron so both go through the
// exact same guards (no double-publish, no placeholder content shipped).
// Every attempt, successful or not, is written to the Blog Uploader log.
export async function publishSavedKeyword(id: string, opts: PublishOptions = {}): Promise<{ url: string }> {
  const ctx: LogContext = { keyword_id: id };
  const trigger = opts.trigger ?? "manual";
  try {
    const result = await doPublish(id, ctx);
    await logBlogEvent({ ...ctxEntry(ctx), event: "upload", status: "success", trigger, by_user: opts.by ?? null, url: result.url, http_status: ctx.httpStatus ?? 200 });
    return result;
  } catch (err) {
    await logBlogEvent({ ...ctxEntry(ctx), event: "upload", status: "failed", trigger, by_user: opts.by ?? null, error: (err as Error).message, http_status: ctx.httpStatus ?? null });
    throw err;
  }
}

function ctxEntry(c: LogContext) {
  return { site_id: c.site_id ?? null, site_label: c.site_label ?? null, keyword_id: c.keyword_id ?? null, keyword: c.keyword ?? null, title: c.title ?? null, slug: c.slug ?? null };
}

async function doPublish(id: string, ctx: LogContext): Promise<{ url: string }> {
  if (!db) throw new PublishError("Supabase not configured");

  const { data: row, error: readErr } = await db
    .from("saved_keywords")
    .select("id,keyword,status,site_id,draft_title,draft_slug,draft_meta,draft_excerpt,draft_html,draft_tag")
    .eq("id", id)
    .single();
  if (readErr || !row) throw new PublishError("Keyword not found");
  ctx.keyword = row.keyword;
  ctx.title = row.draft_title ?? undefined;
  ctx.slug = row.draft_slug ?? undefined;
  ctx.site_id = row.site_id ?? undefined;

  if (row.status === "published") throw new PublishError("Kata kunci ini sudah dipublikasikan.");
  if (!row.draft_html || !row.draft_title || !row.draft_slug) throw new PublishError("Draft belum lengkap.");
  if (row.draft_html.includes(FIRSTHAND_MARKER)) {
    throw new PublishError('Bagian "Dari Pengalaman Kami" masih placeholder. Isi dulu dengan pengalaman nyata sebelum publish.');
  }

  const { data: site, error: siteErr } = await db
    .from("search_console_sites")
    .select("publish_url,publish_secret,label,domain,path_prefix")
    .eq("id", row.site_id)
    .single();
  if (siteErr || !site) throw new PublishError("Site not found");
  ctx.site_label = site.label;

  const endpoint = site.publish_url || process.env.BLOG_PUBLISH_URL;
  const secret = site.publish_secret || process.env.BLOG_PUBLISH_SECRET;
  if (!endpoint || !secret) {
    throw new PublishError(`No publish target set for "${site.label}". Set it in Blog Engine → Connection 2 Web, or set BLOG_PUBLISH_URL / BLOG_PUBLISH_SECRET as a fallback.`);
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
        // Extra, optional: which website this is for. A sub-website has a pathPrefix such as "/ac-tipe-hu/";
        // an endpoint that serves several sites can use it to pick the right blog. Others can ignore it.
        site: { domain: String(site.domain ?? "").split("/")[0], pathPrefix: site.path_prefix ?? null },
      }),
    });
  } catch (err) {
    throw new PublishError(`Tidak bisa menghubungi publisher: ${(err as Error).message}`);
  }
  ctx.httpStatus = res.status;

  const result = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (!res.ok || !result.ok) throw new PublishError(result.error || `Publisher error ${res.status}`);

  await db
    .from("saved_keywords")
    .update({ status: "published", published_url: result.url, published_at: new Date().toISOString() })
    .eq("id", id);

  return { url: result.url! };
}
