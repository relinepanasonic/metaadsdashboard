import { db } from "@/lib/supabase/db";
import { syncInstagramAccount } from "./instagramSync";
import { syncFacebookPage } from "./facebookSync";

export interface SocialAccountRow {
  id: string;
  client_id: string;
  platform: "instagram" | "facebook";
  external_id: string;
  handle: string | null;
}

export interface SocialSyncResult {
  client: string;
  platform: string;
  account: string;
  summary?: string;
  error?: string;
}

// Loads the accounts to sync: everything, or just one client's.
export async function loadAccounts(clientId?: string): Promise<{ account: SocialAccountRow; clientName: string }[]> {
  if (!db) return [];
  let q = db.from("social_accounts").select("id,client_id,platform,external_id,handle,clients(name)");
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const rel = r.clients as unknown as { name: string } | { name: string }[] | null;
    const clientName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
    return { account: r as unknown as SocialAccountRow, clientName: clientName ?? "?" };
  });
}

// Runs each account independently: one failing account (say, a Page that
// isn't assigned to the token yet) never stops the others.
export async function syncAccounts(
  rows: { account: SocialAccountRow; clientName: string }[],
  days: number
): Promise<SocialSyncResult[]> {
  const results: SocialSyncResult[] = [];
  for (const { account, clientName } of rows) {
    const label = account.handle || account.external_id;
    try {
      if (account.platform === "instagram") {
        const r = await syncInstagramAccount(account.external_id, days);
        const errs = [...new Set(r.errors)].slice(0, 2).join(" · ");
        results.push({ client: clientName, platform: "instagram", account: label, summary: `${r.daysStored} days, ${r.postsStored} posts${errs ? ` (${errs})` : ""}` });
      } else {
        const r = await syncFacebookPage(account.external_id);
        const errs = [...new Set(r.errors)].slice(0, 2).join(" · ");
        results.push({ client: clientName, platform: "facebook", account: label, summary: `followers saved, ${r.postsStored} posts${errs ? ` (${errs})` : ""}` });
      }
    } catch (err) {
      results.push({ client: clientName, platform: account.platform, account: label, error: (err as Error).message });
    }
  }
  return results;
}
