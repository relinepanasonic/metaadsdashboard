import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { schedulerConfigured } from "@/lib/services/schedulerAuth";

// Everything the composer needs: brands with the accounts each can post to, and
// whether Make has connected yet.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  const [clients, social, profiles, poll, logins, topics] = await Promise.all([
    db.from("clients").select("id,name").order("name"),
    db.from("social_accounts").select("id,client_id,platform,external_id,handle"),
    db.from("publish_profiles").select("id,client_id,platform,handle,external_id"),
    db.from("scheduler_state").select("value").eq("key", "last_poll").maybeSingle(),
    // migration 0028 columns / table: before it runs these simply read as empty
    db.from("publish_profiles").select("id,token_expires_at").eq("platform", "threads"),
    db.from("threads_topics").select("client_id,name").order("name"),
  ]);
  if (clients.error) return NextResponse.json({ ok: false, error: clients.error.message }, { status: 500 });
  const connected = new Set((logins.data ?? []).filter((l) => l.token_expires_at).map((l) => l.id as string));

  const out = (clients.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    topics: (topics.data ?? []).filter((t) => t.client_id === c.id).map((t) => t.name as string),
    accounts: [
      ...(social.data ?? []).filter((a) => a.client_id === c.id).map((a) => ({ id: a.id, platform: a.platform as string, handle: a.handle as string | null, externalId: a.external_id as string | null, removable: false })),
      // publish_profiles is created by migration 0024; before that it just reads as empty
      ...(profiles.data ?? []).filter((a) => a.client_id === c.id).map((a) => ({ id: a.id, platform: a.platform as string, handle: a.handle as string | null, externalId: a.external_id as string | null, removable: true, connected: a.platform === "threads" ? connected.has(a.id) : undefined })),
    ],
  }));

  return NextResponse.json({
    ok: true,
    clients: out,
    make: { configured: schedulerConfigured(), lastPoll: (poll.data?.value as string | undefined) ?? null },
  });
}
