"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, HardDrive, Loader2 } from "lucide-react";

interface Status {
  ok: boolean;
  warning?: string;
  error?: string;
  drive: { configured: boolean; oauthReady: boolean; folder: { ok: boolean; name?: string; error?: string } | null };
  usage: { bytes: number; files: number; at: string } | null;
  limitBytes: number;
  pending: { files: number; bytes: number } | null;
  archiveAfterDays: number;
  canManage: boolean;
}

const mb = (n: number) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : `${Math.round(n / 1048576)} MB`);

// Storage usage + Google Drive archive, shown above the post list.
export default function StoragePanel() {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (check = false, refresh = false) => {
    const r = await fetch(`/api/storage?${check ? "check=1&" : ""}${refresh ? "refresh=1" : ""}`).then((x) => x.json()).catch(() => null);
    if (r) setS(r as Status);
  }, []);

  useEffect(() => { load(true); }, [load]);

  async function post(action: string) {
    return fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
  }

  // Each call archives what fits in ~4 minutes; keep calling until nothing is left or it stops making progress.
  async function archiveAll() {
    setBusy("archive");
    setNote(null);
    let total = 0, freed = 0, lastMessage = "";
    for (let i = 0; i < 40; i++) {
      const r = await post("archive");
      if (r.error) { setNote({ ok: false, text: r.error }); break; }
      total += (r.archived ?? 0) + (r.missing ?? 0);
      lastMessage = r.message ?? "";
      freed += r.bytesFreed ?? 0;
      setNote({ ok: true, text: `Archiving… ${total} file(s) done so far (${mb(freed)} freed). ${r.remaining ?? 0} left.` });
      if (!r.ok || (r.remaining ?? 0) <= 0 || (r.archived ?? 0) + (r.missing ?? 0) === 0) {
        setNote({ ok: Boolean(r.ok), text: i === 0 || !r.ok ? lastMessage : `Done: ${total} file(s) copied to Google Drive, ${mb(freed)} freed.` });
        break;
      }
    }
    setBusy("");
    load(false, true);
  }

  async function orphans() {
    setBusy("orphans");
    const r = await post("orphans");
    setNote({ ok: Boolean(r.ok), text: r.message ?? r.error ?? "Done." });
    setBusy("");
    load(false, true);
  }

  if (!s) return null;

  const used = s.usage?.bytes ?? 0;
  const pct = s.usage ? Math.min(100, (used / s.limitBytes) * 100) : 0;
  const tone = pct >= 90 ? "rose" : pct >= 70 ? "amber" : "emerald";
  const barCls = { rose: "bg-rose-400", amber: "bg-amber-400", emerald: "bg-emerald-400" }[tone];
  const textCls = { rose: "text-rose-300", amber: "text-amber-300", emerald: "text-emerald-300" }[tone];

  return (
    <div className="glass-panel flex flex-col gap-3 p-3.5" style={pct >= 90 ? { boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.4)" } : undefined}>
      <div className="flex flex-wrap items-center gap-3">
        <HardDrive size={15} className={s.usage ? textCls : "text-slate-500"} />
        {s.usage ? (
          <div className="min-w-[200px] flex-1">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="font-semibold text-slate-200">Storage <span className={textCls}>{mb(used)}</span> <span className="text-slate-500">of {mb(s.limitBytes)} · {s.usage.files} file{s.usage.files === 1 ? "" : "s"}</span></span>
              <span className={`text-[11px] font-bold ${textCls}`}>{pct.toFixed(0)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full ${barCls}`} style={{ width: `${pct}%` }} /></div>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Storage usage unavailable</span>
        )}

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {s.drive.configured ? (
            s.drive.folder && !s.drive.folder.ok ? (
              <span className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 font-semibold text-rose-300" title={s.drive.folder.error}>Drive folder problem</span>
            ) : (
              <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 font-semibold text-emerald-300" title={s.drive.folder?.name ? `Archive folder: ${s.drive.folder.name}` : undefined}>Google Drive archive on</span>
            )
          ) : s.drive.oauthReady && s.canManage ? (
            <a href="/api/google-ads/oauth/start?for=drive" className="rounded-lg bg-cyan-500/20 px-3 py-1.5 font-bold text-cyan-200 hover:bg-cyan-500/30">Connect Google Drive</a>
          ) : (
            <span className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 font-semibold text-amber-300">Google Drive not connected</span>
          )}

          {s.canManage && s.drive.configured && (
            <button onClick={archiveAll} disabled={busy !== "" || !s.pending?.files} className="rounded-lg bg-white/[0.06] px-3 py-1.5 font-semibold text-slate-200 hover:bg-white/[0.1] disabled:opacity-40">
              {busy === "archive" ? "Archiving…" : s.pending?.files ? `Archive ${s.pending.files} file${s.pending.files === 1 ? "" : "s"} now (${mb(s.pending.bytes)})` : "Nothing to archive"}
            </button>
          )}
          {s.canManage && (
            <button onClick={orphans} disabled={busy !== ""} className="rounded-lg bg-white/[0.06] px-3 py-1.5 font-semibold text-slate-200 hover:bg-white/[0.1] disabled:opacity-40">{busy === "orphans" ? "Cleaning…" : "Clean unused uploads"}</button>
          )}
          {busy !== "" && <Loader2 size={13} className="animate-spin text-slate-500" />}
        </div>
      </div>

      {s.warning && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200"><AlertTriangle size={13} className="mt-0.5 shrink-0" />Could not read storage: {s.warning}</div>
      )}
      {pct >= 70 && !s.warning && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] ${pct >= 90 ? "bg-rose-500/10 text-rose-200" : "bg-amber-500/10 text-amber-200"}`}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Storage is {pct.toFixed(0)}% full. {s.drive.configured ? "Use “Archive now” to move finished posts to Google Drive." : "Connect Google Drive so finished posts can be archived automatically."} At 100% the whole dashboard locks until space is freed.
        </div>
      )}
      <div className="text-[11px] text-slate-500">
        {s.drive.configured
          ? `Photos and videos are copied to Google Drive (Workspace › Account › Date) ${s.archiveAfterDays} days after a post is published, then removed from the app's storage. Drafts and scheduled posts are never touched.`
          : "Once Google Drive is connected, photos and videos are copied there after publishing and removed from the app's storage automatically."}
      </div>
      {note && <div className={`rounded-lg px-3 py-2 text-[11px] ${note.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>{note.text}</div>}
    </div>
  );
}
