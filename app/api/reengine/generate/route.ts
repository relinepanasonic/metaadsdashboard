import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { generateContent } from "@/lib/services/reengine";
import { isValidModelId } from "@/lib/seo/constants";
import { LITE_BIBLE } from "@/lib/reengine/liteBible";
import type { SeriesBible, SourcePost } from "@/lib/reengine/types";

export const maxDuration = 300;

// Writes new contents from one successful post. Saved to reengine_runs so it can be reopened and exported.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  const b = (await req.json().catch(() => ({}))) as {
    clientId?: string;
    source?: SourcePost;
    count?: number;
    direction?: string;
    formatHint?: string;
    productKeys?: string[];
    guestKeys?: string[];
    model?: string;
  };
  if (!b.clientId) return NextResponse.json({ ok: false, error: "clientId is required" }, { status: 400 });
  if (!b.source?.caption?.trim()) return NextResponse.json({ ok: false, error: "Pick a successful post or paste its caption first." }, { status: 400 });
  const count = Math.min(Math.max(Math.round(b.count ?? 3), 1), 5);

  // A saved Series Bible is optional. Without one the run uses the built-in quick mode.
  const { data: row, error: bErr } = await db.from("reengine_bibles").select("data").eq("client_id", b.clientId).maybeSingle();
  if (bErr && !/reengine_|schema cache|does not exist/i.test(bErr.message)) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
  const bible = (row?.data as SeriesBible | undefined) ?? LITE_BIBLE;

  try {
    const result = await generateContent({
      bible,
      source: b.source,
      count,
      direction: b.direction,
      formatHint: b.formatHint,
      productKeys: b.productKeys,
      guestKeys: b.guestKeys,
      model: b.model && isValidModelId(b.model) ? b.model : undefined,
    });
    const { data: saved } = await db
      .from("reengine_runs")
      .insert({ client_id: b.clientId, source: b.source, analysis: result.analysis, items: result.items, provider: result.provider, created_by: me.username })
      .select("id")
      .single();
    return NextResponse.json({ ok: true, runId: saved?.id ?? null, quickMode: Boolean(bible.lite), ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
