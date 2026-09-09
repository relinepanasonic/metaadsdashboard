import { db } from "@/lib/supabase/db";

export function bareDomain(input: string): string {
  return input
    .replace(/^sc-domain:/, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .toLowerCase()
    .trim();
}

// Keeps search_console_sites (SEO #1's site registry) in sync with a client's
// website_domain — this is the connection point: add/edit a client's website
// and it shows up as a site in SEO #1 automatically.
export async function syncClientSite(clientId: string, brand: string, domain: string | null): Promise<void> {
  if (!db) return;
  if (!domain) {
    await db.from("search_console_sites").update({ client_id: null }).eq("client_id", clientId);
    return;
  }
  const clean = bareDomain(domain);
  await db.from("search_console_sites").upsert({ domain: clean, label: brand, client_id: clientId }, { onConflict: "domain" });
}
