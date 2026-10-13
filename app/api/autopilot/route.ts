import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { runSetting, type AutopilotSetting } from "@/lib/services/autopilot";
import { qwenConfigured } from "@/lib/services/ai";
import { cleanTopic } from "@/lib/services/threads";

export const maxDuration = 300;

async function staff() {
  const me = await getCurrentUser();
  return me && me.role !== "client" ? me : null;
}

// Everything the Autopilot page needs.
export async function GET() {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  const [settings, profiles, topics, keywords] = await Promise.all([
    db.from("autopilot_settings").select("*"),
    db.from("publish_profiles").select("client_id,handle,token_expires_at").eq("platform", "threads"),
    db.from("threads_topics").select("client_id,name").order("name"),
    db.from("saved_keywords").select("site_id").eq("status", "idea"),
  ]);
  if (settings.error) {
    const missing = /autopilot_settings|schema cache|does not exist/i.test(settings.error.message);
    return NextResponse.json({ ok: false, needsMigration: missing, error: missing ? "Run migration 0029 in Supabase first." : settings.error.message }, { status: 500 });
  }

  const unused: Record<string, number> = {};
  for (const k of keywords.data ?? []) if (k.site_id) unused[k.site_id as string] = (unused[k.site_id as string] ?? 0) + 1;

  return NextResponse.json({
    ok: true,
    settings: settings.data ?? [],
    threadsAccounts: (profiles.data ?? []).map((p) => ({ clientId: p.client_id as string, handle: p.handle as string, connected: Boolean(p.token_expires_at) })),
    topics: (topics.data ?? []).map((t) => ({ clientId: t.client_id as string, name: t.name as string })),
    unusedKeywords: unused,
    ai: { claude: Boolean(process.env.ANTHROPIC_API_KEY), qwen: qwenConfigured() },
  });
}

interface Body {
  kind?: "blog" | "threads";
  clientId?: string | null;
  siteId?: string | null;
  handle?: string | null;
  enabled?: boolean;
  timeWib?: string;
  topic?: string | null;
  samples?: string | null;
  instructions?: string | null;
  model?: string | null;
}

export async function PUT(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const b = (await req.json().catch(() => ({}))) as Body;

  if (b.kind !== "blog" && b.kind !== "threads") return NextResponse.json({ ok: false, error: "kind must be blog or threads" }, { status: 400 });
  if (b.kind === "blog" && !b.siteId) return NextResponse.json({ ok: false, error: "Pick a website." }, { status: 400 });
  if (b.kind === "threads" && (!b.clientId || !b.handle)) return NextResponse.json({ ok: false, error: "Pick a Threads account." }, { status: 400 });
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(b.timeWib ?? "") ? b.timeWib! : "18:00";

  const key = b.kind === "blog" ? `blog:${b.siteId}` : `threads:${b.clientId}:${b.handle}`;
  const row = {
    key,
    kind: b.kind,
    client_id: b.clientId || null,
    site_id: b.kind === "blog" ? b.siteId : null,
    handle: b.kind === "threads" ? b.handle : null,
    enabled: Boolean(b.enabled),
    time_wib: time,
    topic: cleanTopic(b.topic),
    samples: b.samples?.trim() || null,
    instructions: b.instructions?.trim() || null,
    model: b.model || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("autopilot_settings").upsert(row, { onConflict: "key" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, key });
}

// preview = write it but do not publish / schedule; run = do it now.
export async function POST(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const b = (await req.json().catch(() => ({}))) as { key?: string; action?: "preview" | "run" };
  if (!b.key || (b.action !== "preview" && b.action !== "run")) return NextResponse.json({ ok: false, error: "key and action are required" }, { status: 400 });

  const { data } = await db.from("autopilot_settings").select("*").eq("key", b.key).maybeSingle();
  if (!data) return NextResponse.json({ ok: false, error: "Save the settings first." }, { status: 404 });
  const result = await runSetting(data as AutopilotSetting, b.action === "preview" ? { preview: true } : { now: true });
  return NextResponse.json(result);
}
