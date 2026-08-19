import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

const PAGE_SIZE = 200;

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: true, rows: [], total: 0 });

  const sp = req.nextUrl.searchParams;
  const batch = sp.get("batch");
  const country = sp.get("country");
  const gen = sp.get("gen");
  const branch = sp.get("branch");
  const category = sp.get("category");
  const search = sp.get("search")?.trim();
  const minValue = sp.get("min_value");
  const maxValue = sp.get("max_value");
  const offset = Number(sp.get("offset") ?? "0");

  let query = db
    .from("audience_records")
    .select("*", { count: "exact" })
    .order("value", { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (batch) query = query.eq("batch_id", batch);
  if (country) query = query.eq("country", country);
  if (gen) query = query.eq("gen", gen);
  if (branch) query = query.eq("branch_name", branch);
  if (category) query = query.eq("category", category);
  if (minValue) query = query.gte("value", Number(minValue));
  if (maxValue) query = query.lte("value", Number(maxValue));
  if (search) {
    const like = `%${search}%`;
    query = query.or(
      `fn.ilike.${like},ln.ilike.${like},full_name.ilike.${like},email1.ilike.${like},email2.ilike.${like},email3.ilike.${like},uid.ilike.${like}`
    );
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [], total: count ?? 0 });
}
