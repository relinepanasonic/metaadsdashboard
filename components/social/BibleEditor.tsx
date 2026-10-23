"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { MISS_PAN_BIBLE } from "@/lib/reengine/missPanBible";
import type { BibleBlocks, BibleGuest, BibleOutfit, BibleProduct, SeriesBible } from "@/lib/reengine/types";

const inputCls = "w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none [color-scheme:dark]";
const labelCls = "mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500";

const BLOCK_LABELS: Record<keyof BibleBlocks, string> = {
  imageHeader: "Image prompt — header line",
  videoHeader: "Video prompt — header line",
  identityLock: "Identity lock (used when guests appear). Keeps {HOST} and {GUESTS}",
  mood: "Mood",
  lensLight: "Lens & light (image only)",
  cameraVideo: "Camera + realism (video only)",
  referenceNote: "Reference photos note",
  storyboardNote: "Storyboard note (end of the image prompt)",
  productPrefix: "Before every product profile",
  productSuffix: "After every product profile",
  mandatory: "Mandatory rules (video). Keeps {SPOKEN_NAMES}",
  timingHeader: "Camera timing — header",
  scriptHeader: "Script — header. Keeps {WORDS}",
  overlayHeader: "Text overlay — header",
  noOverlayNote: "No subtitles / music note",
  durationNote: "Duration note",
  multiCharNote: "Multi-character note (used when guests appear)",
};

function Section({ title, hint, children, defaultOpen = false }: { title: string; hint?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#0e1420]/70">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        {open ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
        <span className="text-sm font-bold text-white">{title}</span>
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </button>
      {open && <div className="border-t border-white/[0.06] p-4">{children}</div>}
    </section>
  );
}

function Area({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={`${inputCls} resize-y leading-relaxed`} />
    </div>
  );
}

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </div>
  );
}

export default function BibleEditor({ clientId, clientName, initial, onSaved }: { clientId: string; clientName: string; initial: SeriesBible | null; onSaved: (b: SeriesBible) => void }) {
  const [bible, setBible] = useState<SeriesBible | null>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function change(next: SeriesBible) {
    setBible(next);
    setDirty(true);
    setMsg(null);
  }

  async function save() {
    if (!bible) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/reengine/bible", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, bible }) }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network error" }));
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      setMsg({ ok: true, text: "Saved." });
      onSaved(bible);
    } else setMsg({ ok: false, text: res.error ?? "Could not save." });
  }

  if (!bible) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#0e1420]/70 p-6">
        <h2 className="text-sm font-black text-white">No Series Bible for {clientName} yet</h2>
        <p className="mt-2 max-w-[640px] text-xs leading-relaxed text-slate-400">
          The Series Bible holds everything that must stay identical in every video: the host&apos;s look, the apartment, each product&apos;s physical profile, the guest characters and the rules. The Re-Engine pastes these word for word into every prompt, so only the story changes.
        </p>
        <button type="button" onClick={() => change(structuredClone(MISS_PAN_BIBLE))} className="mt-4 rounded-lg bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/30" style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}>
          Load the Miss Pan template (from your Excel)
        </button>
      </div>
    );
  }

  const set = <K extends keyof SeriesBible>(k: K, v: SeriesBible[K]) => change({ ...bible, [k]: v });
  const setBlock = (k: keyof BibleBlocks, v: string) => change({ ...bible, blocks: { ...bible.blocks, [k]: v } });
  const upd = <T,>(list: T[], i: number, patch: Partial<T>) => list.map((x, j) => (j === i ? { ...x, ...patch } : x));

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0b0e14]/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div className="text-sm font-black text-white">{bible.seriesName}</div>
          <div className="text-[11px] text-slate-500">Series Bible for {clientName} · {bible.products.length} products · {bible.guests.length} guests · {bible.outfits.length} outfits</div>
        </div>
        {msg && <span className={`text-[11px] ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>{msg.text}</span>}
        <button type="button" onClick={() => { if (window.confirm("Replace the current bible with the Miss Pan template? Unsaved and saved edits will be overwritten when you press Save.")) change(structuredClone(MISS_PAN_BIBLE)); }} className="ml-auto text-[11px] font-semibold text-slate-500 hover:text-slate-300">
          Reset to template
        </button>
        <button type="button" onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {dirty ? "Save changes" : "Saved"}
        </button>
      </div>

      <Section title="Series" hint="name, host and taglines" defaultOpen>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Series name" value={bible.seriesName} onChange={(v) => set("seriesName", v)} />
          <Text label="Host name" value={bible.hostName} onChange={(v) => set("hostName", v)} />
          <Text label="Main tagline" value={bible.taglines.main} onChange={(v) => set("taglines", { ...bible.taglines, main: v })} />
          <Text label="Sign-off said to camera at the end of every video" value={bible.taglines.signoff} onChange={(v) => set("taglines", { ...bible.taglines, signoff: v })} />
          <div className="sm:col-span-2"><Text label="Long tagline (bio / end card)" value={bible.taglines.long} onChange={(v) => set("taglines", { ...bible.taglines, long: v })} /></div>
        </div>
      </Section>

      <Section title="Host" hint="look, voice — pasted into every prompt">
        <div className="flex flex-col gap-3">
          <Area label="Host character (face, hair, build, signature, energy, wardrobe rules)" value={bible.host} onChange={(v) => set("host", v)} rows={9} />
          <Area label="Host voice" value={bible.hostVoice} onChange={(v) => set("hostVoice", v)} rows={4} />
          <Area label="Location (every scene happens here)" value={bible.location} onChange={(v) => set("location", v)} rows={5} />
        </div>
      </Section>

      <Section title={`Outfits (${bible.outfits.length})`} hint="the host's wardrobe; the AI picks a key per content">
        <div className="flex flex-col gap-3">
          {bible.outfits.map((o, i) => (
            <div key={i} className="rounded-lg bg-white/[0.03] p-3">
              <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                <Text label="Key" value={o.key} onChange={(v) => set("outfits", upd<BibleOutfit>(bible.outfits, i, { key: v.toLowerCase().replace(/\s+/g, "_") }))} />
                <Text label="Label" value={o.label} onChange={(v) => set("outfits", upd<BibleOutfit>(bible.outfits, i, { label: v }))} />
                <button type="button" onClick={() => set("outfits", bible.outfits.filter((_, j) => j !== i))} className="self-end rounded-lg p-2 text-slate-600 hover:bg-rose-500/10 hover:text-rose-300" title="Remove"><Trash2 size={14} /></button>
              </div>
              <div className="mt-2"><Area label="Description used in the prompt" value={o.text} onChange={(v) => set("outfits", upd<BibleOutfit>(bible.outfits, i, { text: v }))} rows={2} /></div>
            </div>
          ))}
          <button type="button" onClick={() => set("outfits", [...bible.outfits, { key: "new_outfit", label: "New outfit", text: "" }])} className="inline-flex items-center gap-1 self-start text-[11px] font-semibold text-cyan-300 hover:underline"><Plus size={12} /> Add an outfit</button>
        </div>
      </Section>

      <Section title={`Products (${bible.products.length})`} hint="physical profile + the only facts the script may claim">
        <div className="flex flex-col gap-3">
          {bible.products.map((p, i) => (
            <div key={i} className={`rounded-lg p-3 ${p.usable ? "bg-white/[0.03]" : "bg-rose-500/[0.06]"}`}>
              <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto_auto]">
                <Text label="Key" value={p.key} onChange={(v) => set("products", upd<BibleProduct>(bible.products, i, { key: v.toLowerCase().replace(/\s+/g, "_") }))} />
                <Text label="Name" value={p.name} onChange={(v) => set("products", upd<BibleProduct>(bible.products, i, { name: v }))} />
                <label className="flex items-center gap-1.5 self-end pb-2 text-[11px] text-slate-300">
                  <input type="checkbox" checked={p.usable} onChange={(e) => set("products", upd<BibleProduct>(bible.products, i, { usable: e.target.checked }))} className="accent-cyan-400" /> Allowed in content
                </label>
                <button type="button" onClick={() => set("products", bible.products.filter((_, j) => j !== i))} className="self-end rounded-lg p-2 text-slate-600 hover:bg-rose-500/10 hover:text-rose-300" title="Remove"><Trash2 size={14} /></button>
              </div>
              <div className="mt-2 grid gap-2">
                <Area label="Physical profile (matches the official product photo)" value={p.profile} onChange={(v) => set("products", upd<BibleProduct>(bible.products, i, { profile: v }))} rows={3} />
                <Area label="Claims the script may say (nothing else is allowed)" value={p.claims} onChange={(v) => set("products", upd<BibleProduct>(bible.products, i, { claims: v }))} rows={2} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Text label="Source of the claims" value={p.source} onChange={(v) => set("products", upd<BibleProduct>(bible.products, i, { source: v }))} />
                  <Text label="Note" value={p.note} onChange={(v) => set("products", upd<BibleProduct>(bible.products, i, { note: v }))} />
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => set("products", [...bible.products, { key: "new_product", name: "New product", profile: "", claims: "", source: "", note: "", usable: true }])} className="inline-flex items-center gap-1 self-start text-[11px] font-semibold text-cyan-300 hover:underline"><Plus size={12} /> Add a product</button>
        </div>
      </Section>

      <Section title={`Guest characters (${bible.guests.length})`} hint="each guest must look clearly different from the host">
        <div className="flex flex-col gap-3">
          {bible.guests.map((g, i) => (
            <div key={i} className="rounded-lg bg-white/[0.03] p-3">
              <div className="grid gap-2 sm:grid-cols-[160px_1fr_1fr_auto]">
                <Text label="Key" value={g.key} onChange={(v) => set("guests", upd<BibleGuest>(bible.guests, i, { key: v.toLowerCase().replace(/\s+/g, "_") }))} />
                <Text label="Name" value={g.name} onChange={(v) => set("guests", upd<BibleGuest>(bible.guests, i, { name: v }))} />
                <Text label="Role" value={g.role} onChange={(v) => set("guests", upd<BibleGuest>(bible.guests, i, { role: v }))} />
                <button type="button" onClick={() => set("guests", bible.guests.filter((_, j) => j !== i))} className="self-end rounded-lg p-2 text-slate-600 hover:bg-rose-500/10 hover:text-rose-300" title="Remove"><Trash2 size={14} /></button>
              </div>
              <div className="mt-2 grid gap-2">
                <Area label="Look (pasted into the prompt after “GUEST CHARACTER —”)" value={g.profile} onChange={(v) => set("guests", upd<BibleGuest>(bible.guests, i, { profile: v }))} rows={3} />
                <Area label="Voice line (starts with NAME's VOICE: …)" value={g.voice} onChange={(v) => set("guests", upd<BibleGuest>(bible.guests, i, { voice: v }))} rows={2} />
              </div>
            </div>
          ))}
          <button type="button" onClick={() => set("guests", [...bible.guests, { key: "new_guest", name: "New guest", role: "", profile: "", voice: "" }])} className="inline-flex items-center gap-1 self-start text-[11px] font-semibold text-cyan-300 hover:underline"><Plus size={12} /> Add a guest</button>
        </div>
      </Section>

      <Section title="Series rules" hint="one rule per line; the AI must follow all of them">
        <Area label="Rules" value={bible.rules.join("\n")} onChange={(v) => set("rules", v.split("\n").map((l) => l.trim()).filter(Boolean))} rows={10} />
      </Section>

      <Section title="Prompt wording" hint="the fixed paragraphs of the image and video prompts">
        <div className="flex flex-col gap-3">
          {(Object.keys(BLOCK_LABELS) as (keyof BibleBlocks)[]).map((k) => (
            <Area key={k} label={BLOCK_LABELS[k]} value={bible.blocks[k]} onChange={(v) => setBlock(k, v)} rows={k === "productPrefix" || k === "productSuffix" || k === "imageHeader" || k === "videoHeader" || k === "timingHeader" || k === "overlayHeader" ? 2 : 4} />
          ))}
        </div>
      </Section>

      <Section title="Example content" hint="a finished content the AI uses as the quality bar">
        <Area label={`Example: ${bible.exampleMeta?.title ?? ""}`} value={bible.example} onChange={(v) => set("example", v)} rows={16} />
      </Section>
    </div>
  );
}
