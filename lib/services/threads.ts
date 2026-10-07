// Threads posting straight through Meta's Threads API (no Make.com).
//
// Each Threads account is connected once with Threads' own login (OAuth). Its long-lived token
// (valid ~60 days, renewed automatically) is kept encrypted in publish_profiles.access_token.
// Publishing follows Meta's two steps: create a container (text / photo / video, or a carousel
// of containers) -> publish it. Docs: developers.facebook.com/docs/threads/posts

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { MediaItem } from "./scheduler";

const API = "https://graph.threads.net/v1.0";
const OAUTH = "https://graph.threads.net";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const THREADS_TOPIC_LIMIT = 50;

export function threadsConfigured(): boolean {
  return Boolean(process.env.THREADS_APP_ID && process.env.THREADS_APP_SECRET && process.env.SCHEDULER_SECRET);
}

// ---- token storage: encrypted so a database reader cannot post as the account ----------------------
function key(): Buffer {
  return createHash("sha256").update(`threads-token:${process.env.THREADS_APP_SECRET ?? ""}:${process.env.SCHEDULER_SECRET ?? ""}`).digest();
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptToken(stored: string): string {
  const [iv, tag, enc] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

// ---- signed "state" so the OAuth callback knows which brand it is for and cannot be forged ------------
export function signState(payload: { clientId: string }): string {
  const body = Buffer.from(JSON.stringify({ ...payload, t: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", process.env.SCHEDULER_SECRET ?? "").update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readState(state: string): { clientId: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expect = createHmac("sha256", process.env.SCHEDULER_SECRET ?? "").update(body).digest("base64url");
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { clientId: string; t: number };
  if (Date.now() - parsed.t > 15 * 60_000) return null; // the login link is only good for 15 minutes
  return { clientId: parsed.clientId };
}

// ---- OAuth ------------------------------------------------------------------------------------------------------------
export function authorizeUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.THREADS_APP_ID ?? "",
    redirect_uri: redirectUri,
    scope: "threads_basic,threads_content_publish",
    response_type: "code",
    state,
  });
  return `https://threads.net/oauth/authorize?${q}`;
}

interface ApiError { error?: { message?: string; error_user_msg?: string; code?: number } }

function fail(json: ApiError, status: number): never {
  const e = json.error;
  throw new Error(e ? `${e.error_user_msg || e.message}${e.code ? ` (code ${e.code})` : ""}` : `Threads API ${status}`);
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = (await res.json().catch(() => ({}))) as T & ApiError;
  if (!res.ok || json.error) fail(json, res.status);
  return json;
}

// code -> long-lived token + who it belongs to
export async function connectWithCode(code: string, redirectUri: string): Promise<{ userId: string; username: string; token: string; expiresAt: string }> {
  const short = await call<{ access_token: string; user_id: string | number }>(`${OAUTH}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.THREADS_APP_ID ?? "",
      client_secret: process.env.THREADS_APP_SECRET ?? "",
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const long = await call<{ access_token: string; expires_in: number }>(
    `${OAUTH}/access_token?${new URLSearchParams({ grant_type: "th_exchange_token", client_secret: process.env.THREADS_APP_SECRET ?? "", access_token: short.access_token })}`
  );
  const me = await call<{ id: string; username: string }>(`${API}/me?${new URLSearchParams({ fields: "id,username", access_token: long.access_token })}`);
  return { userId: String(me.id), username: me.username, token: long.access_token, expiresAt: new Date(Date.now() + long.expires_in * 1000).toISOString() };
}

// A long-lived token can be renewed any time after 24 hours and before it expires.
export async function refreshToken(token: string): Promise<{ token: string; expiresAt: string }> {
  const r = await call<{ access_token: string; expires_in: number }>(
    `${OAUTH}/refresh_access_token?${new URLSearchParams({ grant_type: "th_refresh_token", access_token: token })}`
  );
  return { token: r.access_token, expiresAt: new Date(Date.now() + r.expires_in * 1000).toISOString() };
}

// ---- publishing ------------------------------------------------------------------------------------------------------
async function create(userId: string, token: string, params: Record<string, string>): Promise<string> {
  const r = await call<{ id: string }>(`${API}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, access_token: token }),
  });
  return r.id;
}

async function waitReady(id: string, token: string, what: string, maxSeconds: number): Promise<void> {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    const s = await call<{ status?: string; error_message?: string }>(`${API}/${id}?${new URLSearchParams({ fields: "status,error_message", access_token: token })}`);
    if (s.status === "FINISHED" || s.status === "PUBLISHED") return;
    if (s.status === "ERROR" || s.status === "EXPIRED") throw new Error(`Threads could not process ${what}${s.error_message ? `: ${s.error_message}` : ""}.`);
    await sleep(3000);
  }
  throw new Error(`Threads took too long to process ${what}.`);
}

export interface ThreadsPost {
  caption: string;
  contentType: string; // reel | video | image | carousel | text
  media: MediaItem[];
  topic?: string | null;
}

// Threads topic tags: up to 50 characters, no periods or ampersands, no leading #.
export function cleanTopic(topic: string | null | undefined): string | null {
  const t = (topic ?? "").replace(/^#+/, "").replace(/[.&]/g, "").replace(/\s+/g, " ").trim().slice(0, THREADS_TOPIC_LIMIT);
  return t || null;
}

export async function publishThread(userId: string, token: string, post: ThreadsPost): Promise<{ id: string; permalink: string | null }> {
  const topic = cleanTopic(post.topic);
  const extra: Record<string, string> = {};
  if (post.caption.trim()) extra.text = post.caption;
  if (topic) extra.topic_tag = topic;

  let creationId: string;
  if (post.contentType === "carousel") {
    if (post.media.length < 2 || post.media.length > 20) throw new Error("A Threads carousel needs 2 to 20 photos or videos.");
    const children: string[] = [];
    for (const [i, m] of post.media.entries()) {
      const id = await create(userId, token, m.kind === "video" ? { media_type: "VIDEO", video_url: m.url, is_carousel_item: "true" } : { media_type: "IMAGE", image_url: m.url, is_carousel_item: "true" });
      await waitReady(id, token, `item ${i + 1} (${m.name ?? m.kind})`, m.kind === "video" ? 90 : 30);
      children.push(id);
    }
    creationId = await create(userId, token, { media_type: "CAROUSEL", children: children.join(","), ...extra });
    await waitReady(creationId, token, "the carousel", 30);
  } else if (post.contentType === "text") {
    creationId = await create(userId, token, { media_type: "TEXT", ...extra });
  } else {
    const m = post.media[0];
    if (!m) throw new Error("This post has no photo or video.");
    creationId = await create(userId, token, m.kind === "video" ? { media_type: "VIDEO", video_url: m.url, ...extra } : { media_type: "IMAGE", image_url: m.url, ...extra });
    await waitReady(creationId, token, m.name ?? m.kind, m.kind === "video" ? 90 : 30);
  }

  const published = await call<{ id: string }>(`${API}/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: creationId, access_token: token }),
  });
  const info = await call<{ permalink?: string }>(`${API}/${published.id}?${new URLSearchParams({ fields: "permalink", access_token: token })}`).catch(() => ({ permalink: undefined }));
  return { id: published.id, permalink: info.permalink ?? null };
}
