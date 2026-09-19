import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { discoverAccounts } from "@/lib/services/instagram";

// Instagram accounts the token can reach — powers the "Find accounts" picker
// on the Clients page so nobody has to copy numeric ids by hand.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    return NextResponse.json({ ok: true, accounts: await discoverAccounts() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
