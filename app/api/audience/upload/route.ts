import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import type { AudienceRow } from "@/lib/audience";

// Insert a parsed CSV as a new batch. Body: { label: string, rows: AudienceRow[] }
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { label, rows } = (await req.json()) as { label: string; rows: AudienceRow[] };
  if (!label || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Missing label or rows" }, { status: 400 });
  }

  const { data: batch, error: batchErr } = await db
    .from("audience_batches")
    .insert({ label, row_count: rows.length, uploaded_by: me.id })
    .select("id")
    .single();
  if (batchErr || !batch) {
    return NextResponse.json({ ok: false, error: batchErr?.message ?? "Failed to create batch" }, { status: 500 });
  }

  // Insert in chunks to stay well under Supabase's request size limits.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => ({ ...r, batch_id: batch.id }));
    const { error } = await db.from("audience_records").insert(chunk);
    if (error) {
      // Roll back the batch (cascades to any rows already inserted).
      await db.from("audience_batches").delete().eq("id", batch.id);
      return NextResponse.json({ ok: false, error: `Row ${i + 1}: ${error.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, batchId: batch.id, count: rows.length });
}
