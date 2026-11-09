import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasFullAccess } from "@/lib/auth/currentUser";
import { checkRootFolder, driveConfigured, driveOauthReady } from "@/lib/services/drive";
import { archiveBatch, archivePreview, ARCHIVE_AFTER_DAYS, cleanOrphans, measureUsage, readUsage, storageLimitBytes } from "@/lib/services/mediaArchive";

export const maxDuration = 300;

// GET: storage usage, Drive connection and what is waiting to be archived (any staff member).
// POST: { action: "archive" | "orphans" | "refresh" } — Founder / Superadmin only.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const drive = { configured: driveConfigured(), oauthReady: driveOauthReady(), folder: null as null | { ok: boolean; name?: string; error?: string } };
  if (drive.configured && req.nextUrl.searchParams.get("check") === "1") drive.folder = await checkRootFolder();

  try {
    let usage = await readUsage();
    const stale = !usage || Date.now() - Date.parse(usage.at) > 30 * 60_000;
    if (stale || req.nextUrl.searchParams.get("refresh") === "1") usage = await measureUsage();
    const pending = await archivePreview();
    return NextResponse.json({ ok: true, drive, usage, limitBytes: storageLimitBytes(), pending, archiveAfterDays: ARCHIVE_AFTER_DAYS, canManage: hasFullAccess(me.role) });
  } catch (e) {
    // e.g. the project is over its quota: say so plainly instead of a blank panel.
    return NextResponse.json({ ok: true, drive, usage: null, limitBytes: storageLimitBytes(), pending: null, archiveAfterDays: ARCHIVE_AFTER_DAYS, canManage: hasFullAccess(me.role), warning: e instanceof Error ? e.message : String(e) });
  }
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !hasFullAccess(me.role)) return NextResponse.json({ ok: false, error: "Founder or Superadmin only" }, { status: 403 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };

  try {
    if (action === "archive") {
      // One call does what fits in ~4 minutes; the page calls it again until nothing is left.
      const r = await archiveBatch({ budgetMs: 200_000 });
      const usage = await measureUsage().catch(() => null);
      return NextResponse.json({ ...r, usage });
    }
    if (action === "orphans") {
      const o = await cleanOrphans();
      const usage = await measureUsage().catch(() => null);
      return NextResponse.json({ ok: true, message: `Removed ${o.deleted} unused upload(s), freed ${(o.bytes / 1048576).toFixed(1)} MB.`, ...o, usage });
    }
    if (action === "refresh") {
      const usage = await measureUsage();
      return NextResponse.json({ ok: true, usage, message: "Usage refreshed." });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
