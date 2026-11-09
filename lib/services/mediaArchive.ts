// ============================================================================
// MEDIA ARCHIVE — keeps Supabase Storage small.
// ----------------------------------------------------------------------------
// A post's photos/videos are only needed by Instagram / TikTok / YouTube until
// the post is published. After that we copy each file to Google Drive
// (Workspace > Account > Date) and delete it from Supabase Storage.
//
// Safety rules:
//  * A file is deleted from Storage only after Drive confirms the same byte size.
//  * Files of drafts, scheduled and retryable (failed) posts are never touched.
//  * A file shared by several posts (Duplicate) goes only when all of them are done.
//  * Without a Drive connection nothing is archived or deleted.
// ============================================================================
import { db as realDb } from "@/lib/supabase/db";
import { driveConfigured, ensurePath, safeName, uploadFile } from "./drive";
import type { MediaItem } from "./scheduler";

const BUCKET = "social-media";
const DAY = 86_400_000;
const WIB_MS = 7 * 3600_000;

export const ARCHIVE_AFTER_DAYS = Math.max(1, Number(process.env.ARCHIVE_AFTER_DAYS) || 7);
export const FAILED_KEEP_DAYS = 30; // a failed post can still be retried, so its files stay longer

type Db = NonNullable<typeof realDb>;

export interface PostTarget { platform: string; handle: string | null; status: string; published_at: string | null }
export interface PostRow {
  id: string;
  client_id: string | null;
  caption: string | null;
  media: MediaItem[] | null;
  scheduled_at: string;
  status: string;
  updated_at?: string | null;
  clients?: { name: string } | { name: string }[] | null;
  scheduled_post_targets?: PostTarget[] | null;
}

export interface StoredFile { path: string; size: number; createdAt: string }

export interface DownloadResult { ok: boolean; status: number; bytes?: Uint8Array; mime?: string }

export interface ArchiveDeps {
  db: Db;
  now: () => number;
  driveReady: () => boolean;
  ensurePath: (segments: string[]) => Promise<string>;
  uploadFile: (parent: string, name: string, mime: string, data: Uint8Array, description?: string) => Promise<{ id: string; size: number; url: string }>;
  download: (url: string) => Promise<DownloadResult>;
  removeFiles: (paths: string[]) => Promise<void>;
  listBucket: () => Promise<StoredFile[]>;
}

// ---- pure rules (unit tested) -------------------------------------------------------------------------------------
export function clientName(p: PostRow): string {
  const c = Array.isArray(p.clients) ? p.clients[0] : p.clients;
  return c?.name?.trim() || "No workspace";
}

const ACCOUNT_ORDER = ["instagram", "youtube", "tiktok", "facebook", "threads"];

// The folder for a post is named after its main account (Instagram first); other accounts are noted in the file description.
export function primaryAccount(p: PostRow): string {
  const t = [...(p.scheduled_post_targets ?? [])].sort((a, b) => ACCOUNT_ORDER.indexOf(a.platform) - ACCOUNT_ORDER.indexOf(b.platform));
  const first = t[0];
  if (!first) return "No account";
  return safeName(first.handle?.trim() || first.platform);
}

export function wibDate(iso: string): string {
  return new Date(Date.parse(iso) + WIB_MS).toISOString().slice(0, 10);
}

export function postDay(p: PostRow): string {
  const published = (p.scheduled_post_targets ?? []).map((t) => t.published_at).filter((x): x is string => Boolean(x)).sort()[0];
  return wibDate(published ?? p.scheduled_at);
}

export function folderSegments(p: PostRow): string[] {
  return [clientName(p), primaryAccount(p), postDay(p)];
}

// A post is "done" when its files are no longer needed for publishing.
export function isDone(p: PostRow, nowMs: number, days = ARCHIVE_AFTER_DAYS): boolean {
  if (!p.media?.length) return false;
  if (p.status === "draft") return false;
  const t = p.scheduled_post_targets ?? [];
  if (t.some((x) => x.status === "pending" || x.status === "claimed")) return false;
  const wait = days * DAY;
  if (t.length === 0) return p.status === "cancelled" && nowMs - Date.parse(p.updated_at ?? p.scheduled_at) >= wait;
  if (t.some((x) => x.status === "failed")) return nowMs - Date.parse(p.scheduled_at) >= FAILED_KEEP_DAYS * DAY;
  const published = t.map((x) => x.published_at).filter((x): x is string => Boolean(x)).map(Date.parse);
  const last = published.length ? Math.max(...published) : Date.parse(p.updated_at ?? p.scheduled_at);
  return nowMs - last >= wait;
}

export function storagePathOf(url: string): string | null {
  const part = url.split(`/${BUCKET}/`)[1];
  if (!part) return null;
  try { return decodeURIComponent(part.split("?")[0]); } catch { return null; }
}

function mimeOf(m: MediaItem, fromServer?: string): string {
  if (fromServer && fromServer !== "application/octet-stream") return fromServer.split(";")[0];
  const ext = (m.name ?? m.url).split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v", webm: "video/webm" };
  return map[ext] ?? (m.kind === "video" ? "video/mp4" : "image/jpeg");
}

// ---- real dependencies --------------------------------------------------------------------------------------------
async function walk(d: Db, prefix: string, depth: number, out: StoredFile[]): Promise<void> {
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await d.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`Could not list storage: ${error.message}`);
    for (const o of data ?? []) {
      const path = prefix ? `${prefix}/${o.name}` : o.name;
      if (!o.id) { if (depth < 4) await walk(d, path, depth + 1, out); continue; } // a folder
      out.push({ path, size: Number((o.metadata as { size?: number } | null)?.size ?? 0), createdAt: o.created_at ?? new Date(0).toISOString() });
    }
    if (!data || data.length < 1000) break;
  }
}

export function realDeps(): ArchiveDeps {
  if (!realDb) throw new Error("Database not configured.");
  const d = realDb;
  return {
    db: d,
    now: () => Date.now(),
    driveReady: driveConfigured,
    ensurePath,
    uploadFile,
    download: async (url) => {
      const r = await fetch(url);
      if (!r.ok) return { ok: false, status: r.status };
      return { ok: true, status: r.status, bytes: new Uint8Array(await r.arrayBuffer()), mime: r.headers.get("content-type") ?? undefined };
    },
    removeFiles: async (paths) => {
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await d.storage.from(BUCKET).remove(paths.slice(i, i + 100));
        if (error) throw new Error(`Could not delete from storage: ${error.message}`);
      }
    },
    listBucket: async () => {
      const out: StoredFile[] = [];
      await walk(d, "", 0, out);
      return out;
    },
  };
}

// ---- loading ------------------------------------------------------------------------------------------------------
async function loadPosts(d: Db): Promise<PostRow[]> {
  const rows: PostRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await d
      .from("scheduled_posts")
      .select("id,client_id,caption,media,scheduled_at,status,updated_at,clients(name),scheduled_post_targets(platform,handle,status,published_at)")
      .order("scheduled_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as PostRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

interface Candidate { url: string; item: MediaItem; refs: PostRow[]; rep: PostRow }

// Every live file that no unfinished post still needs, oldest first.
export function findCandidates(posts: PostRow[], nowMs: number, days = ARCHIVE_AFTER_DAYS): Candidate[] {
  const refs = new Map<string, { post: PostRow; item: MediaItem }[]>();
  for (const p of posts) for (const m of p.media ?? []) if (!m.removed) (refs.get(m.url) ?? refs.set(m.url, []).get(m.url)!).push({ post: p, item: m });
  const out: Candidate[] = [];
  for (const [url, list] of refs) {
    if (!list.every((r) => isDone(r.post, nowMs, days))) continue;
    const rep = [...list].sort((a, b) => a.post.scheduled_at.localeCompare(b.post.scheduled_at))[0];
    out.push({ url, item: rep.item, refs: list.map((r) => r.post), rep: rep.post });
  }
  return out.sort((a, b) => a.rep.scheduled_at.localeCompare(b.rep.scheduled_at));
}

export async function archivePreview(deps: ArchiveDeps = realDeps()): Promise<{ files: number; bytes: number }> {
  const c = findCandidates(await loadPosts(deps.db), deps.now());
  return { files: c.length, bytes: c.reduce((n, x) => n + (x.item.size ?? 0), 0) };
}

// ---- archive ------------------------------------------------------------------------------------------------------
export interface ArchiveResult {
  ok: boolean;
  archived: number;
  missing: number;
  bytesFreed: number;
  remaining: number;
  errors: string[];
  message: string;
}

async function markPosts(d: Db, refs: PostRow[], url: string, patch: Partial<MediaItem>): Promise<void> {
  for (const p of refs) {
    const { data } = await d.from("scheduled_posts").select("media").eq("id", p.id).single();
    const media = ((data?.media ?? []) as MediaItem[]).map((m) => (m.url === url ? { ...m, ...patch } : m));
    const { error } = await d.from("scheduled_posts").update({ media }).eq("id", p.id);
    if (error) throw new Error(`Could not update the post: ${error.message}`);
  }
}

export async function archiveBatch(opts: { budgetMs: number; maxFiles?: number }, deps: ArchiveDeps = realDeps()): Promise<ArchiveResult> {
  const result: ArchiveResult = { ok: true, archived: 0, missing: 0, bytesFreed: 0, remaining: 0, errors: [], message: "" };
  if (!deps.driveReady()) {
    return { ...result, ok: false, message: "Google Drive is not connected, so nothing was archived or deleted." };
  }
  const started = deps.now();
  const candidates = findCandidates(await loadPosts(deps.db), deps.now());
  result.remaining = candidates.length;

  for (const c of candidates) {
    if (deps.now() - started > opts.budgetMs || result.archived + result.missing >= (opts.maxFiles ?? 1e9) || result.errors.length >= 5) break;
    try {
      const path = storagePathOf(c.url);
      const dl = await deps.download(c.url);

      if (!dl.ok || !dl.bytes) {
        if (dl.status === 404 || dl.status === 400) {
          // Already gone from Storage: nothing to copy; just stop showing a broken thumbnail.
          await markPosts(deps.db, c.refs, c.url, { removed: true });
          result.missing++;
          result.remaining--;
          continue;
        }
        throw new Error(`download ${dl.status}`);
      }

      const folder = await deps.ensurePath(folderSegments(c.rep));
      const others = (c.rep.scheduled_post_targets ?? []).map((t) => `${t.platform}${t.handle ? " " + t.handle : ""}`).join(", ");
      const description = `Post ${c.rep.id} · ${others || "no account"}${c.rep.caption ? ` · ${c.rep.caption.replace(/\s+/g, " ").slice(0, 300)}` : ""}`;
      const name = c.item.name || (path ?? "file").split("/").pop()!;
      const file = await deps.uploadFile(folder, name, mimeOf(c.item, dl.mime), dl.bytes, description);
      if (file.size !== dl.bytes.byteLength) throw new Error(`Drive stored ${file.size} bytes but ${dl.bytes.byteLength} were sent; kept the original`);

      // Record the Drive copy first, then free the space. If the delete fails the leftover file is an orphan that cleanup removes.
      await markPosts(deps.db, c.refs, c.url, { removed: true, drive: { id: file.id, url: file.url, path: folderSegments(c.rep).join("/") } });
      if (path) await deps.removeFiles([path]);
      result.archived++;
      result.bytesFreed += dl.bytes.byteLength;
      result.remaining--;
    } catch (e) {
      result.errors.push(`${c.item.name ?? c.url.split("/").pop()}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  result.ok = result.errors.length === 0;
  result.message =
    `Archived ${result.archived} file(s) to Google Drive${result.missing ? `, ${result.missing} were already missing` : ""}; freed ${(result.bytesFreed / 1048576).toFixed(1)} MB.` +
    (result.remaining > 0 ? ` ${result.remaining} left.` : " Nothing left to archive.") +
    (result.errors.length ? ` Problems: ${result.errors.join(" | ")}` : "");
  return result;
}

// ---- orphans: files in Storage that no post uses (abandoned uploads) -----------------------------------------------
export async function cleanOrphans(opts: { olderThanHours?: number } = {}, deps: ArchiveDeps = realDeps()): Promise<{ deleted: number; bytes: number }> {
  const minAge = (opts.olderThanHours ?? 48) * 3600_000;
  const posts = await loadPosts(deps.db);
  const used = new Set<string>();
  for (const p of posts) for (const m of p.media ?? []) if (!m.removed) { const s = storagePathOf(m.url); if (s) used.add(s); }
  const files = await deps.listBucket();
  const orphans = files.filter((f) => !used.has(f.path) && deps.now() - Date.parse(f.createdAt) >= minAge);
  if (orphans.length) await deps.removeFiles(orphans.map((f) => f.path));
  return { deleted: orphans.length, bytes: orphans.reduce((n, f) => n + f.size, 0) };
}

// ---- usage ----------------------------------------------------------------------------------------------------------
export interface UsageSnapshot { bytes: number; files: number; at: string }

export function storageLimitBytes(): number {
  const gb = Number(process.env.STORAGE_LIMIT_GB);
  return (Number.isFinite(gb) && gb > 0 ? gb : 1) * 1024 ** 3;
}

export async function measureUsage(deps: ArchiveDeps = realDeps()): Promise<UsageSnapshot> {
  const files = await deps.listBucket();
  const snap: UsageSnapshot = { bytes: files.reduce((n, f) => n + f.size, 0), files: files.length, at: new Date(deps.now()).toISOString() };
  await deps.db.from("scheduler_state").upsert({ key: "storage_usage", value: JSON.stringify(snap), updated_at: snap.at });
  return snap;
}

export async function readUsage(deps: ArchiveDeps = realDeps()): Promise<UsageSnapshot | null> {
  const { data } = await deps.db.from("scheduler_state").select("value").eq("key", "storage_usage").maybeSingle();
  try { return data?.value ? (JSON.parse(data.value as string) as UsageSnapshot) : null; } catch { return null; }
}

// What the daily cron does: archive what is due (within its time budget), clear orphans, refresh the usage number.
export async function runMaintenance(budgetMs: number): Promise<string> {
  const deps = realDeps();
  const parts: string[] = [];
  if (deps.driveReady()) parts.push((await archiveBatch({ budgetMs }, deps)).message);
  else parts.push("Drive not connected: archive skipped.");
  const o = await cleanOrphans({}, deps);
  if (o.deleted) parts.push(`Removed ${o.deleted} unused upload(s) (${(o.bytes / 1048576).toFixed(1)} MB).`);
  const u = await measureUsage(deps);
  parts.push(`Storage now ${(u.bytes / 1048576).toFixed(0)} MB in ${u.files} file(s).`);
  return parts.join(" ");
}
