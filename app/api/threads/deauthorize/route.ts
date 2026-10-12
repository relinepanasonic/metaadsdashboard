import { NextRequest, NextResponse } from "next/server";
import { forgetThreadsUser, parseSignedRequest } from "@/lib/services/threadsCallbacks";

// Meta calls this when someone removes the app from their Threads account (the "Deauthorize callback URL").
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const data = parseSignedRequest(form ? (form.get("signed_request") as string | null) : null);
  if (!data?.user_id) return NextResponse.json({ ok: false }, { status: 400 });
  await forgetThreadsUser(String(data.user_id));
  return NextResponse.json({ ok: true });
}
