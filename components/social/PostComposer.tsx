"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import CustomSelect from "@/components/CustomSelect";
import { createClient } from "@/lib/supabase/client";
import {
  CAPTION_LIMIT, CONTENT_LABEL, PLATFORM_LABEL, PLATFORMS, validatePost,
  type ContentType, type MediaItem, type Platform,
} from "@/lib/services/scheduler";

export interface SchedOptions {
  clients: { id: string; name: string; accounts: { id: string; platform: string; handle: string | null; externalId: string | null; removable: boolean }[] }[];
}

export interface EditablePost {
  id: string;
  clientId: string | null;
  caption: string;
  contentType: ContentType;
  media: MediaItem[];
  scheduledAt: string;
  status: string;
  targets: { platform: string; handle: string | null; external_id: string | null }[];
}

const MAX_BYTES = 50 * 1024 * 1024; // Supabase free-plan file ceiling
const TYPES: ContentType[] = ["reel", "video", "image", "carousel", "text"];

// The scheduler works in Jakarta time whatever the viewer's computer says.
const WIB = "+07:00";
function wibParts(iso: string | null): { date: string; time: string } {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60_000);
  const shifted = new Date(d.getTime() + 7 * 3600_000);
  const s = shifted.toISOString();
  return { date: s.slice(0, 10), time: iso ? s.slice(11, 16) : `${s.slice(11, 13)}:00` };
}

const inputCls = "w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none [color-scheme:dark]";
const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500";

export default function PostComposer({ options, post, onClose, onSaved, onOptionsChanged }: {
  options: SchedOptions;
  post: EditablePost | null;
  onClose: () => void;
  onSaved: () => void;
  onOptionsChanged: () => void;
}) {
  const init = wibParts(post?.scheduledAt ?? null);
  const [clientId, setClientId] = useState(post?.clientId ?? options.clients[0]?.id ?? "");
  const [contentType, setContentType] = useState<ContentType>(post?.contentType ?? "reel");
  const [media, setMedia] = useState<MediaItem[]>(post?.media ?? []);
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [picked, setPicked] = useState<Set<string>>(() => new Set((post?.targets ?? []).map((t) => `${t.platform}|${t.handle ?? ""}`)));
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newProfile, setNewProfile] = useState<{ platform: "threads" | "tiktok"; handle: string }>({ platform: "threads", handle: "" });
  const [addingProfile, setAddingProfile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const client = options.clients.find((c) => c.id === clientId);
  const accounts = client?.accounts ?? [];
  const byPlatform = useMemo(() => PLATFORMS.map((p) => ({ platform: p, list: accounts.filter((a) => a.platform === p) })), [accounts]);

  const targets = accounts
    .filter((a) => picked.has(`${a.platform}|${a.handle ?? ""}`))
    .map((a) => ({ platform: a.platform as Platform, handle: a.handle, externalId: a.externalId }));

  const tightest = targets.length > 0 ? Math.min(...targets.map((t) => CAPTION_LIMIT[t.platform])) : 2200;
  const accept = contentType === "image" ? "image/*" : contentType === "reel" || contentType === "video" ? "video/*" : "image/*,video/*";
  const single = contentType !== "carousel";

  function toggle(a: { platform: string; handle: string | null }) {
    const key = `${a.platform}|${a.handle ?? ""}`;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function chooseClient(id: string) {
    setClientId(id);
    setPicked(new Set());
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    const supabase = createClient();
    const list = Array.from(files);
    const room = single ? 1 : 10 - media.length;
    for (const file of list.slice(0, Math.max(room, 0))) {
      if (file.size > MAX_BYTES) {
        setError(`"${file.name}" is ${(file.size / 1048576).toFixed(0)} MB — the limit is 50 MB. Compress it first.`);
        continue;
      }
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) {
        setError(`"${file.name}" is not a photo or video.`);
        continue;
      }
      setUploading((n) => n + 1);
      const ym = new Date().toISOString().slice(0, 7);
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const path = `${clientId || "general"}/${ym}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("social-media").upload(path, file, { contentType: file.type, upsert: false });
      setUploading((n) => n - 1);
      if (upErr) {
        setError(/bucket/i.test(upErr.message) ? "The media bucket doesn't exist yet — run migration 0024 in Supabase." : `Upload failed: ${upErr.message}`);
        continue;
      }
      const url = supabase.storage.from("social-media").getPublicUrl(path).data.publicUrl;
      const item: MediaItem = { url, kind: isVideo ? "video" : "image", name: file.name, size: file.size };
      setMedia((prev) => (single ? [item] : [...prev, item]));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function addProfile() {
    if (!clientId || !newProfile.handle.trim()) return;
    setError("");
    const res = await fetch("/api/scheduler/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, platform: newProfile.platform, handle: newProfile.handle }),
    }).then((r) => r.json());
    if (!res.ok) return setError(res.error || "Could not add the account.");
    setNewProfile((p) => ({ ...p, handle: "" }));
    setAddingProfile(false);
    onOptionsChanged();
  }

  async function removeProfile(id: string) {
    await fetch(`/api/scheduler/profiles?id=${id}`, { method: "DELETE" });
    onOptionsChanged();
  }

  async function save(status: "draft" | "scheduled") {
    setError("");
    const scheduledAt = new Date(`${date}T${time}:00${WIB}`);
    if (Number.isNaN(scheduledAt.getTime())) return setError("Pick a valid date and time.");
    if (status === "scheduled") {
      const problem = validatePost({ contentType, media, caption, targets });
      if (problem) return setError(problem);
    }
    setSaving(true);
    const res = await fetch(post ? `/api/scheduler/posts/${post.id}` : "/api/scheduler/posts", {
      method: post ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, caption, contentType, media, scheduledAt: scheduledAt.toISOString(), status, targets }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
    setSaving(false);
    if (!res.ok) return setError(res.error || "Could not save.");
    onSaved();
  }

  const inPast = new Date(`${date}T${time}:00${WIB}`).getTime() < Date.now() - 60_000;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-[760px] rounded-2xl border border-white/[0.12] bg-[#0e1420] p-4 shadow-2xl sm:p-6" role="dialog" aria-modal="true">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white" aria-label="Close"><X size={18} /></button>
        <h2 className="text-base font-black text-white">{post ? "Edit scheduled post" : "New scheduled post"}</h2>

        {/* Brand + accounts */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Brand</span>
            <CustomSelect value={clientId} onChange={chooseClient} options={options.clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="Pick a brand" />
          </div>
          <div>
            <span className={labelCls}>Content type</span>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setContentType(t); if (t === "text") setMedia([]); else if (t !== "carousel") setMedia((m) => m.slice(0, 1)); }}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${contentType === t ? "bg-cyan-500/15 text-cyan-300" : "bg-white/[0.04] text-slate-400 hover:text-slate-200"}`}
                  style={contentType === t ? { boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)" } : undefined}
                >
                  {CONTENT_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <span className={labelCls}>Post to</span>
          {!client ? (
            <div className="rounded-lg bg-white/[0.03] p-3 text-xs text-slate-500">Pick a brand first.</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {byPlatform.map(({ platform, list }) => (
                <div key={platform} className="rounded-xl bg-white/[0.03] p-3">
                  <div className="mb-1.5 text-[11px] font-semibold text-slate-300">{PLATFORM_LABEL[platform]}</div>
                  {list.length === 0 ? (
                    <div className="text-[11px] text-slate-600">
                      {platform === "instagram" || platform === "facebook" ? "None linked — add it on the Clients page." : "None added yet."}
                    </div>
                  ) : (
                    list.map((a) => {
                      const on = picked.has(`${a.platform}|${a.handle ?? ""}`);
                      return (
                        <label key={a.id} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-slate-200">
                          <input type="checkbox" checked={on} onChange={() => toggle(a)} className="h-3.5 w-3.5 accent-cyan-400" />
                          <span className="truncate">{a.handle ?? a.externalId}</span>
                          {a.removable && (
                            <button type="button" onClick={(e) => { e.preventDefault(); removeProfile(a.id); }} className="ml-auto text-slate-600 hover:text-rose-300" title="Remove this account"><Trash2 size={11} /></button>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          )}
          {client && (
            <div className="mt-2">
              {addingProfile ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-[120px]"><CustomSelect size="sm" value={newProfile.platform} onChange={(v) => setNewProfile((p) => ({ ...p, platform: v as "threads" | "tiktok" }))} options={[{ value: "threads", label: "Threads" }, { value: "tiktok", label: "TikTok" }]} /></div>
                  <input value={newProfile.handle} onChange={(e) => setNewProfile((p) => ({ ...p, handle: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addProfile()} placeholder="@username" className={`${inputCls} max-w-[200px]`} />
                  <button type="button" onClick={addProfile} className="rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25">Add</button>
                  <button type="button" onClick={() => setAddingProfile(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                </div>
              ) : (
                <button type="button" onClick={() => setAddingProfile(true)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:underline"><Plus size={12} /> Add a Threads or TikTok account</button>
              )}
            </div>
          )}
        </div>

        {/* Media */}
        {contentType !== "text" && (
          <div className="mt-5">
            <span className={labelCls}>{single ? (contentType === "image" ? "Photo" : "Video") : "Photos / videos (2–10)"}</span>
            <div className="flex flex-wrap gap-3">
              {media.map((m, i) => (
                <div key={m.url} className="relative h-[120px] w-[84px] overflow-hidden rounded-xl bg-white/[0.04]" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
                  {m.kind === "video" ? (
                    <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- our own storage URL
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  )}
                  <button type="button" onClick={() => setMedia((prev) => prev.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-rose-500" aria-label="Remove"><X size={11} /></button>
                </div>
              ))}
              {(single ? media.length === 0 : media.length < 10) && (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading > 0} className="grid h-[120px] w-[84px] place-items-center rounded-xl border border-dashed border-white/[0.2] text-slate-500 hover:border-cyan-500/50 hover:text-cyan-300 disabled:opacity-60">
                  {uploading > 0 ? <Loader2 size={20} className="animate-spin" /> : <span className="flex flex-col items-center gap-1 text-[10px]"><ImagePlus size={20} />Upload</span>}
                </button>
              )}
              <input ref={fileRef} type="file" accept={accept} multiple={!single} className="hidden" onChange={(e) => upload(e.target.files)} />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-600">Up to 50 MB per file. Reels: vertical 9:16 MP4 (H.264) works everywhere.</p>
          </div>
        )}

        {/* Caption */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className={labelCls}>Caption</span>
            <span className={`text-[11px] ${caption.length > tightest ? "text-rose-300" : "text-slate-600"}`}>{caption.length} / {tightest}{targets.length > 1 ? " (tightest platform)" : ""}</span>
          </div>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} placeholder="Write the caption, hashtags and mentions…" className={`${inputCls} resize-y`} />
        </div>

        {/* When */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-[360px]">
          <div><span className={labelCls}>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>
          <div><span className={labelCls}>Time (WIB)</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} /></div>
        </div>
        {inPast && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300"><AlertTriangle size={12} /> That time has passed — it will be posted the next time Make checks in.</p>
        )}

        {error && <div className="mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200">Cancel</button>
          <button type="button" onClick={() => save("draft")} disabled={saving || uploading > 0} className="rounded-lg bg-white/[0.06] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.1] disabled:opacity-50">Save as draft</button>
          <button type="button" onClick={() => save("scheduled")} disabled={saving || uploading > 0} className="rounded-lg bg-cyan-500/20 px-5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50" style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}>
            {saving ? "Saving…" : post ? "Save & schedule" : "Schedule post"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
