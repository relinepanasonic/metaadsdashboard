import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  cleanCustomerId,
  fetchAccountInfo,
  googleConfigured,
  googleOauthConfigured,
  listAccessibleCustomers,
  listManagedAccounts,
  type AccountInfo,
} from "@/lib/services/googleAds";

// Setup + account picker for staff. `?live=1` also asks Google which accounts
// the connected login can open (costs a few API calls, so only on demand).
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (me.role === "client") return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  const [{ data: accounts }, { data: clients }] = await Promise.all([
    db.from("google_ads_accounts").select("customer_id,name,currency,is_manager,last_synced_at,last_error,first_data_date").order("name"),
    db.from("clients").select("name,google_ads_account_id").not("google_ads_account_id", "is", null),
  ]);
  const brandOf = new Map<string, string>();
  for (const c of clients ?? []) brandOf.set(cleanCustomerId(c.google_ads_account_id), c.name);

  const out: {
    ok: true;
    configured: boolean;
    oauthConfigured: boolean;
    accounts: unknown[];
    unsyncedBrands: { brand: string; customerId: string }[];
    live?: (AccountInfo & { brand: string | null })[];
    liveError?: string;
  } = {
    ok: true,
    configured: googleConfigured(),
    oauthConfigured: googleOauthConfigured(),
    accounts: (accounts ?? []).filter((a) => !a.is_manager).map((a) => ({ ...a, brand: brandOf.get(a.customer_id) ?? null })),
    unsyncedBrands: [...brandOf.entries()]
      .filter(([id]) => !(accounts ?? []).some((a) => a.customer_id === id))
      .map(([customerId, brand]) => ({ brand, customerId })),
  };

  if (req.nextUrl.searchParams.get("live") === "1" && googleConfigured()) {
    try {
      const found = new Map<string, AccountInfo>();
      for (const id of await listAccessibleCustomers()) {
        try {
          const info = await fetchAccountInfo(id);
          if (info.isManager) {
            for (const child of await listManagedAccounts(id)) if (!child.isManager) found.set(child.customerId, child);
          } else {
            found.set(info.customerId, info);
          }
        } catch {
          // Listed but not openable directly (needs a manager login id) — still show it.
          found.set(id, { customerId: id, name: id, currency: "", timeZone: "", isManager: false });
        }
      }
      out.live = [...found.values()].map((a) => ({ ...a, brand: brandOf.get(a.customerId) ?? null }));
    } catch (err) {
      out.liveError = (err as Error).message;
    }
  }

  return NextResponse.json(out);
}
