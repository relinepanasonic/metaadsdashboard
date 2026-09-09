import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { publishSavedKeyword, PublishError } from "@/lib/services/publishKeyword";

export const maxDuration = 120;

// Manual "Publish now" — skips the auto-drip queue entirely.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ ok: false, error: "Missing keyword id" }, { status: 400 });

  try {
    const { url } = await publishSavedKeyword(id);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    const status = err instanceof PublishError ? 400 : 500;
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status });
  }
}
