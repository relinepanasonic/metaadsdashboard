import { NextRequest, NextResponse } from "next/server";
import { forgetThreadsUser, parseSignedRequest } from "@/lib/services/threadsCallbacks";

// Meta's "Data Deletion Requests URL". It must answer with a status page address and a confirmation code.
// This app keeps nothing about a Threads user except the login token, which is wiped here.
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const data = parseSignedRequest(form ? (form.get("signed_request") as string | null) : null);
  if (!data?.user_id) return NextResponse.json({ ok: false }, { status: 400 });
  await forgetThreadsUser(String(data.user_id));
  const code = `del-${String(data.user_id)}-${Date.now().toString(36)}`;
  return NextResponse.json({ url: `${req.nextUrl.origin}/api/threads/delete?code=${code}`, confirmation_code: code });
}

// The status page Meta shows the person.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") ?? "";
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Data deletion</title><body style="font-family:sans-serif;max-width:480px;margin:60px auto"><h1>Data deletion</h1><p>Your Threads login has been removed from our scheduling tool. We store nothing else about your Threads account.</p>${code ? `<p>Confirmation code: <b>${code.replace(/[^a-z0-9-]/gi, "")}</b></p>` : ""}</body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
