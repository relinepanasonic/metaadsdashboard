import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { aiComplete } from "@/lib/services/ai";
import { firstOf, parseMarked } from "@/lib/reengine/parse";

export const maxDuration = 90;

async function staff() {
  const me = await getCurrentUser();
  return me && me.role !== "client" ? me : null;
}

interface Variant {
  label: string;
  hook: string;
  mediaId?: string | null; // our own posted Reel that used this hook
}

// TEST step: a hook A/B test. Variants are hook lines; once each is posted, link it to the Reel that used it and the
// page compares their 3-second skip rates and watch time.
export async function POST(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const b = (await req.json().catch(() => ({}))) as { action?: "create" | "suggest"; accountId?: string; title?: string; notes?: string; variants?: Variant[]; topic?: string; baseHook?: string; niche?: string };

  if (b.action === "suggest") {
    // three different hook lines for the same content
    const topic = (b.topic ?? "").trim();
    if (!topic) return NextResponse.json({ ok: false, error: "Write what the content is about first." }, { status: 400 });
    try {
      const r = await aiComplete({
        system: "Kamu penulis hook Instagram Reels berbahasa Indonesia. Hook = kalimat pembuka 3 detik pertama.",
        user: `Topik konten: ${topic}\n${b.niche ? `Niche akun: ${b.niche}\n` : ""}${b.baseHook ? `Hook awal: ${b.baseHook}\n` : ""}\nTulis 3 hook yang BERBEDA jenisnya untuk konten yang sama (mis. pertanyaan, pernyataan berani, cerita singkat). Maksimal 18 kata per hook, natural, tanpa angka atau klaim yang dikarang.\nBalas HANYA dengan penanda ini:\n[[A]]\nhook A\n[[B]]\nhook B\n[[C]]\nhook C`,
        maxTokens: 600,
        claudeModel: "claude-sonnet-5",
      });
      const s = parseMarked(r.text);
      const hooks = ["A", "B", "C"].map((k) => firstOf(s, k)).filter(Boolean);
      if (hooks.length === 0) return NextResponse.json({ ok: false, error: "The model did not return hooks in the expected format. Try again." }, { status: 500 });
      return NextResponse.json({ ok: true, hooks });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  if (!b.accountId || !b.title?.trim()) return NextResponse.json({ ok: false, error: "Pick an account and give the test a title." }, { status: 400 });
  const variants = (b.variants ?? []).filter((v) => v.hook?.trim()).slice(0, 4).map((v, i) => ({ label: v.label || String.fromCharCode(65 + i), hook: v.hook.trim(), mediaId: v.mediaId ?? null }));
  if (variants.length < 2) return NextResponse.json({ ok: false, error: "A test needs at least two hooks to compare." }, { status: 400 });
  const { data, error } = await db.from("radar_tests").insert({ account_id: b.accountId, title: b.title.trim(), notes: b.notes?.trim() || null, variants }).select("id").single();
  if (error) return NextResponse.json({ ok: false, error: /radar_|schema cache/i.test(error.message) ? "Run migration 0031 in Supabase first." : error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

// Link a posted Reel to a variant (or change the hooks).
export async function PUT(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; variants?: Variant[] };
  if (!b.id || !Array.isArray(b.variants)) return NextResponse.json({ ok: false, error: "id and variants are required" }, { status: 400 });
  const { error } = await db.from("radar_tests").update({ variants: b.variants.slice(0, 4) }).eq("id", b.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  const { error } = await db.from("radar_tests").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
