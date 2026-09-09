import { db } from "@/lib/supabase/db";
import { FIRSTHAND_MARKER } from "@/lib/seo/constants";

export class PublishError extends Error {}

// Hands a finished draft to that site's own blog-automation deployment, which
// renders it with the site's template and uploads it over FTP. Shared by the
// manual "Publish now" route and the auto-publish cron so both go through the
// exact same guards (no double-publish, no placeholder content shipped).
export async function publishSavedKeyword(id: string): Promise<{ url: string }> {
  if (!db) throw new PublishError("Supabase not configured");

  const { data: row, error: readErr } = await db
    .from("saved_keywords")
    .select("id,keyword,status,site_id,draft_title,draft_slug,draft_meta,draft_excerpt,draft_html,draft_tag")
    .eq("id", id)
    .single();
  if (readErr || !row) throw new PublishError("Keyword not found");
  if (row.status === "published") throw new PublishError("Kata kunci ini sudah dipublikasikan.");
  if (!row.draft_html || !row.draft_title || !row.draft_slug) throw new PublishError("Draft belum lengkap.");
  if (row.draft_html.includes(FIRSTHAND_MARKER)) {
    throw new PublishError('Bagian "Dari Pengalaman Kami" masih placeholder. Isi dulu dengan pengalaman nyata sebelum publish.');
  }

  const { data: site, error: siteErr } = await db
    .from("search_console_sites")
    .select("publish_url,publish_secret,label")
    .eq("id", row.site_id)
    .single();
  if (siteErr || !site) throw new PublishError("Site not found");

  const endpoint = site.publish_url || process.env.BLOG_PUBLISH_URL;
  const secret = site.publish_secret || process.env.BLOG_PUBLISH_SECRET;
  if (!endpoint || !secret) {
    throw new PublishError(`No publish target set for "${site.label}". Set it in Manage Websites, or set BLOG_PUBLISH_URL / BLOG_PUBLISH_SECRET as a fallback.`);
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
    throw new PublishError(`Tidak bisa menghubungi publisher: ${(err as Error).message}`);
  }

  const result = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (!res.ok || !result.ok) throw new PublishError(result.error || `Publisher error ${res.status}`);

  await db
    .from("saved_keywords")
    .update({ status: "published", published_url: result.url, published_at: new Date().toISOString() })
    .eq("id", id);

  return { url: result.url! };
}
