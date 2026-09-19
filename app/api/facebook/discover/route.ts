import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { discoverPages } from "@/lib/services/facebook";

// Facebook Pages the token can see — powers the "Find pages" picker.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    return NextResponse.json({ ok: true, pages: await discoverPages() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
