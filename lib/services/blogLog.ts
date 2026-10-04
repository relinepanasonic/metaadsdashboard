import { db } from "@/lib/supabase/db";

export interface BlogLogEntry {
  site_id?: string | null;
  site_label?: string | null;
  keyword_id?: string | null;
  keyword?: string | null;
  title?: string | null;
  slug?: string | null;
  event: "upload" | "received";
  status: "success" | "failed" | "received";
  trigger: "manual" | "auto" | "ai-office";
  by_user?: string | null;
  url?: string | null;
  http_status?: number | null;
  error?: string | null;
}

// Writes one line of the Blog Uploader log. Never throws and never blocks a publish: if the log table
// has not been created yet (migration 0027) or the write fails, the upload itself is unaffected.
export async function logBlogEvent(entry: BlogLogEntry): Promise<void> {
  if (!db) return;
  try {
    await db.from("blog_upload_log").insert({ ...entry, error: entry.error ? entry.error.slice(0, 500) : null });
  } catch {
    /* logging is best effort */
  }
}
