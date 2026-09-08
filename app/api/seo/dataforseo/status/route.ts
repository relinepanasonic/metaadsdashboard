import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { DATAFORSEO_CONFIGURED } from "@/lib/services/dataforseo";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true, configured: DATAFORSEO_CONFIGURED });
}
