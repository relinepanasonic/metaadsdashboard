import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { INSTAGRAM_CONFIGURED, REQUIRED_PERMISSIONS, fetchGrantedPermissions } from "@/lib/services/instagram";

// Whether the Meta token can read Instagram yet, and which permissions are missing.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!INSTAGRAM_CONFIGURED) return NextResponse.json({ ok: true, configured: false, missing: [...REQUIRED_PERMISSIONS] });

  try {
    const granted = await fetchGrantedPermissions();
    const missing = REQUIRED_PERMISSIONS.filter((p) => !granted.includes(p));
    return NextResponse.json({ ok: true, configured: true, ready: missing.length === 0, missing });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
