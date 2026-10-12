// Meta's Threads "deauthorize" and "data deletion" callbacks send a signed_request. Once it checks out
// against the app secret, the stored login for that Threads account is wiped.

import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/supabase/db";

export function parseSignedRequest(signed: string | null): { user_id?: string } | null {
  const secret = process.env.THREADS_APP_SECRET;
  if (!signed || !secret) return null;
  const [sig, payload] = signed.split(".");
  if (!sig || !payload) return null;
  const expect = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expect.length || !timingSafeEqual(given, expect)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function forgetThreadsUser(userId: string): Promise<void> {
  if (!db) return;
  await db.from("publish_profiles").update({ access_token: null, token_expires_at: null }).eq("platform", "threads").eq("external_id", userId);
}
