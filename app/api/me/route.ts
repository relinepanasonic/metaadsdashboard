import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, user: me });
}
