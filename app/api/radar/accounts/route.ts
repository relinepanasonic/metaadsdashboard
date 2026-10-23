import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { geminiConfigured } from "@/lib/services/radar";

// Our own Instagram accounts, each with its radar settings. Every account has its own niche and its own watchlist.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  const [accounts, config, watch] = await Promise.all([
    db.from("social_accounts").select("id,client_id,handle,external_id").eq("platform", "instagram").order("handle"),
    db.from("radar_accounts").select("account_id,niche,auto,last_run_at,last_status"),
    db.from("radar_watch").select("account_id"),
  ]);
  if (accounts.error) return NextResponse.json({ ok: false, error: accounts.error.message }, { status: 500 });
  if (config.error && /radar_|schema cache|does not exist/i.test(config.error.message)) {
    return NextResponse.json({ ok: false, needsMigration: true, error: "Run migration 0031 in Supabase first." }, { status: 500 });
  }

  const cfg = new Map((config.data ?? []).map((c) => [c.account_id as string, c]));
  const counts = new Map<string, number>();
  for (const w of watch.data ?? []) counts.set(w.account_id as string, (counts.get(w.account_id as string) ?? 0) + 1);

  return NextResponse.json({
    ok: true,
    gemini: geminiConfigured(),
    accounts: (accounts.data ?? []).map((a) => {
      const c = cfg.get(a.id as string);
      return {
        id: a.id as string,
        clientId: a.client_id as string,
        handle: a.handle as string | null,
        niche: (c?.niche as string | null) ?? "",
        auto: Boolean(c?.auto),
        lastRunAt: (c?.last_run_at as string | null) ?? null,
        lastStatus: (c?.last_status as string | null) ?? null,
        watching: counts.get(a.id as string) ?? 0,
      };
    }),
  });
}
