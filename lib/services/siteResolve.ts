import { db } from "@/lib/supabase/db";

export interface EffectiveGscTarget {
  siteUrl: string;
  pathPrefix?: string;
  label: string;
}

// A sub-site has no site_url of its own — it inherits its parent's GSC
// connection and scopes every query to its path_prefix. Resolves a siteId to
// the actual property + optional path filter to query against.
export async function resolveGscTarget(siteId: string): Promise<EffectiveGscTarget | null> {
  if (!db) return null;

  const { data: site, error } = await db
    .from("search_console_sites")
    .select("site_url,label,parent_site_id,path_prefix")
    .eq("id", siteId)
    .single();
  if (error || !site) return null;

  if (site.site_url) {
    return { siteUrl: site.site_url, label: site.label };
  }

  if (site.parent_site_id) {
    const { data: parent, error: parentErr } = await db
      .from("search_console_sites")
      .select("site_url")
      .eq("id", site.parent_site_id)
      .single();
    if (parentErr || !parent?.site_url) return null;
    return { siteUrl: parent.site_url, pathPrefix: site.path_prefix ?? undefined, label: site.label };
  }

  return null;
}
