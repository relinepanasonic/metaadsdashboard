import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { SEARCH_CONSOLE_CONFIGURED } from "@/lib/services/searchConsole";

// Is the shared service account configured at all? (Superadmin one-time setup)
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true, configured: SEARCH_CONSOLE_CONFIGURED });
}
