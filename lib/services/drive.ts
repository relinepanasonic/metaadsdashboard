// ============================================================================
// GOOGLE DRIVE — archive folder for social media files. No SDK, plain REST.
// ----------------------------------------------------------------------------
// Signs in with a user OAuth refresh token (the same Google OAuth client the
// Google Ads connection uses). Files are created in the owner's Drive, so they
// count against the owner's quota, not a service account's.
//
// Env vars (server-side only):
//   GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET   OAuth client (shared)
//   GOOGLE_DRIVE_REFRESH_TOKEN                        from "Connect Google Drive"
//   GOOGLE_DRIVE_ROOT_FOLDER_ID                       optional; defaults to the archive folder below
// ============================================================================
import { db } from "@/lib/supabase/db";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DEFAULT_ROOT = "1cTCiEc75tLdss9F2LVZBLZizLZfy2dRe";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export function driveRootId(): string {
  return (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "").trim() || DEFAULT_ROOT;
}

export function driveOauthReady(): boolean {
  return Boolean(process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET);
}

export function driveConfigured(): boolean {
  return driveOauthReady() && Boolean((process.env.GOOGLE_DRIVE_REFRESH_TOKEN ?? "").trim());
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
      refresh_token: (process.env.GOOGLE_DRIVE_REFRESH_TOKEN ?? "").trim(),
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    const why = json.error_description || json.error || `HTTP ${res.status}`;
    throw new Error(
      json.error === "invalid_grant"
        ? `Google rejected the Drive token (${why}). If the OAuth consent screen is still in "Testing", tokens expire after 7 days — publish it to "In production", then use Connect Google Drive again.`
        : `Google sign-in for Drive failed: ${why}`
    );
  }
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await accessToken()}` } });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try { msg = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? msg; } catch { /* keep raw text */ }
    if (res.status === 403 && /has not been used|disabled/i.test(msg)) msg = `The Google Drive API is not enabled for this Google Cloud project. Enable it, wait a minute, retry. (${msg})`;
    throw new Error(`Drive ${res.status}: ${msg}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

// Folder / file names: no path separators or control characters, never empty.
export function safeName(raw: string, max = 80): string {
  const s = String(raw ?? "")
    // eslint-disable-next-line no-control-regex -- control characters are exactly what is being removed
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, max)
    .trim();
  return s || "Untitled";
}

const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function findFolder(parentId: string, name: string): Promise<string | null> {
  const query = `mimeType='application/vnd.google-apps.folder' and name='${q(name)}' and '${parentId}' in parents and trashed=false`;
  const r = await api<{ files?: { id: string }[] }>(`${API}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  return r.files?.[0]?.id ?? null;
}

async function createFolder(parentId: string, name: string): Promise<string> {
  const r = await api<{ id: string }>(`${API}/files?fields=id&supportsAllDrives=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  return r.id;
}

// Walks / creates Workspace > Account > Date under the archive root. Each level's id is remembered in drive_folders.
export async function ensurePath(segments: string[]): Promise<string> {
  let parent = driveRootId();
  let key = "";
  for (const raw of segments) {
    const name = safeName(raw);
    key = key ? `${key}/${name}` : name;
    let id: string | null = null;
    if (db) {
      const { data } = await db.from("drive_folders").select("folder_id").eq("path", key).maybeSingle();
      id = (data?.folder_id as string | undefined) ?? null;
    }
    if (id) {
      // The remembered folder may have been deleted or trashed in Drive since: re-check cheaply.
      const ok = await api<{ trashed?: boolean }>(`${API}/files/${id}?fields=trashed&supportsAllDrives=true`).then((f) => !f.trashed).catch(() => false);
      if (!ok) id = null;
    }
    if (!id) {
      id = (await findFolder(parent, name)) ?? (await createFolder(parent, name));
      if (db) await db.from("drive_folders").upsert({ path: key, folder_id: id });
    }
    parent = id;
  }
  return parent;
}

export interface DriveFile {
  id: string;
  size: number;
  url: string;
}

// Resumable upload in one request: fine for files up to the 50 MB the uploader allows.
export async function uploadFile(parentId: string, name: string, mime: string, data: Uint8Array, description?: string): Promise<DriveFile> {
  const init = await fetch(`${UPLOAD}/files?uploadType=resumable&fields=id,size,webViewLink&supportsAllDrives=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mime,
      "X-Upload-Content-Length": String(data.byteLength),
    },
    body: JSON.stringify({ name: safeName(name, 120), parents: [parentId], ...(description ? { description: description.slice(0, 900) } : {}) }),
  });
  const where = init.headers.get("location");
  if (!init.ok || !where) throw new Error(`Drive ${init.status}: could not start the upload (${(await init.text()).slice(0, 200)})`);

  const put = await fetch(where, { method: "PUT", headers: { "Content-Type": mime, "Content-Length": String(data.byteLength) }, body: data as unknown as BodyInit });
  const text = await put.text();
  if (!put.ok) throw new Error(`Drive ${put.status}: upload failed (${text.slice(0, 200)})`);
  const f = JSON.parse(text) as { id: string; size?: string; webViewLink?: string };
  return { id: f.id, size: Number(f.size ?? data.byteLength), url: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view` };
}

export async function checkRootFolder(): Promise<{ ok: boolean; name?: string; canAdd?: boolean; error?: string }> {
  try {
    const f = await api<{ name: string; trashed?: boolean; mimeType: string; capabilities?: { canAddChildren?: boolean } }>(
      `${API}/files/${driveRootId()}?fields=name,trashed,mimeType,capabilities(canAddChildren)&supportsAllDrives=true`
    );
    if (f.mimeType !== "application/vnd.google-apps.folder") return { ok: false, error: "The archive folder id is not a folder." };
    if (f.trashed) return { ok: false, error: "The archive folder is in the trash." };
    if (f.capabilities?.canAddChildren === false) return { ok: false, name: f.name, canAdd: false, error: `This Google account can only view "${f.name}". Share it with Editor access.` };
    return { ok: true, name: f.name, canAdd: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
