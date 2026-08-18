import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: true, users: [] });

  let query = db.from("app_users").select("id,username,email,role,client_name,created_at").order("created_at", { ascending: false });
  // Advertisers can only see Client accounts, not other staff.
  if (me.role === "advertiser") query = query.eq("role", "client");

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Attach assigned ad accounts for advertiser rows (superadmin view only).
  const advertiserIds = (data ?? []).filter((u) => u.role === "advertiser").map((u) => u.id);
  let accountsByUser = new Map<string, string[]>();
  if (advertiserIds.length > 0) {
    const { data: assigns } = await db.from("advertiser_accounts").select("user_id,ad_account_id").in("user_id", advertiserIds);
    accountsByUser = new Map();
    for (const a of assigns ?? []) {
      const arr = accountsByUser.get(a.user_id) ?? [];
      arr.push(a.ad_account_id);
      accountsByUser.set(a.user_id, arr);
    }
  }

  const users = (data ?? []).map((u) => ({ ...u, adAccountIds: accountsByUser.get(u.id) ?? [] }));
  return NextResponse.json({ ok: true, users });
}
