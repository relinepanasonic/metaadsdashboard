import { db } from "@/lib/supabase/db";
import type { AppUser } from "./currentUser";

// What one brand owns. Staff (founder / superadmin / advertiser) are not scoped;
// a Client user only ever sees the rows listed here. An unknown brand resolves
// to an EMPTY scope, never to "everything".
export interface ClientScope {
  clientId: string | null;
  clientName: string;
  siteIds: string[];
  socialAccountIds: string[];
}

export function isClientUser(me: AppUser): boolean {
  return me.role === "client";
}

export async function getClientScope(me: AppUser): Promise<ClientScope> {
  const empty: ClientScope = { clientId: null, clientName: me.clientName ?? "", siteIds: [], socialAccountIds: [] };
  if (!db || !me.clientName) return empty;

  const { data: client } = await db.from("clients").select("id").eq("name", me.clientName).maybeSingle();
  if (!client) return empty;

  const [sites, social] = await Promise.all([
    db.from("search_console_sites").select("id").eq("client_id", client.id),
    db.from("social_accounts").select("id").eq("client_id", client.id),
  ]);

  return {
    clientId: client.id,
    clientName: me.clientName,
    siteIds: (sites.data ?? []).map((s) => s.id),
    socialAccountIds: (social.data ?? []).map((a) => a.id),
  };
}
