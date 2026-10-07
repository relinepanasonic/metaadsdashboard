import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { connectWithCode, encryptToken, readState, threadsConfigured } from "@/lib/services/threads";

// Threads sends the person back here after they log in and approve.
export async function GET(req: NextRequest) {
  const back = (msg: string, ok = false) => NextResponse.redirect(new URL(`/clients?threads=${ok ? "connected" : "error"}&msg=${encodeURIComponent(msg)}`, req.nextUrl.origin));

  if (!threadsConfigured() || !db) return back("Threads isn't configured on the server yet.");
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back(q.get("error_description") || "Threads login was cancelled.");

  const state = q.get("state") ? readState(q.get("state")!) : null;
  const code = q.get("code");
  if (!state || !code) return back("That login link has expired — start again from the Clients page.");

  try {
    const acct = await connectWithCode(code.replace(/#_$/, ""), `${req.nextUrl.origin}/api/threads/callback`);
    const handle = `@${acct.username}`;
    const { error } = await db.from("publish_profiles").upsert(
      { client_id: state.clientId, platform: "threads", handle, external_id: acct.userId, access_token: encryptToken(acct.token), token_expires_at: acct.expiresAt },
      { onConflict: "client_id,platform,handle" }
    );
    if (error) return back(/access_token|token_expires_at/.test(error.message) ? "Run migration 0028 in Supabase first." : error.message);
    return back(`${handle} is connected.`, true);
  } catch (e) {
    return back(e instanceof Error ? e.message : "Could not connect the Threads account.");
  }
}
