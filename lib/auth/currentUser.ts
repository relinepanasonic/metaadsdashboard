import { createClient } from "@/lib/supabase/server";

export type Role = "superadmin" | "advertiser" | "client";

export interface AppUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  clientName: string | null; // set when role === 'client'
  adAccountIds: string[]; // set when role === 'advertiser'
}

// Resolves the logged-in Supabase Auth user into our app_users row + scope.
// Returns null if not logged in or not yet provisioned in app_users.
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row } = await supabase
    .from("app_users")
    .select("id,username,email,role,client_name")
    .eq("id", user.id)
    .single();

  if (!row) return null;

  let adAccountIds: string[] = [];
  if (row.role === "advertiser") {
    const { data: assigned } = await supabase
      .from("advertiser_accounts")
      .select("ad_account_id")
      .eq("user_id", row.id);
    adAccountIds = (assigned ?? []).map((a) => a.ad_account_id);
  }

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role as Role,
    clientName: row.client_name,
    adAccountIds,
  };
}
