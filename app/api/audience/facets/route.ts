import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";

// Distinct filter values. Simple v1: sample up to 5000 rows and dedupe in JS
// — fine for CSV-batch-sized audiences.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: true, countries: [], genders: [], branches: [], categories: [] });

  const { data, error } = await db
    .from("audience_records")
    .select("country,gen,branch_name,category")
    .limit(5000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const uniq = (key: "country" | "gen" | "branch_name" | "category") =>
    Array.from(new Set((data ?? []).map((r) => r[key]).filter(Boolean))).sort();

  return NextResponse.json({
    ok: true,
    countries: uniq("country"),
    genders: uniq("gen"),
    branches: uniq("branch_name"),
    categories: uniq("category"),
  });
}
