"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

function CopyBox({ text, multiline = false }: { text: string; multiline?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="group relative mt-1.5">
      <pre className={`overflow-x-auto rounded-lg bg-black/40 p-2.5 pr-9 font-mono text-[11px] text-cyan-200 ${multiline ? "whitespace-pre" : "whitespace-pre-wrap break-all"}`}>{text}</pre>
      <button
        type="button"
        onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
        className="absolute right-1.5 top-1.5 rounded p-1 text-slate-400 hover:bg-white/[0.08] hover:text-white"
        title="Copy"
      >
        {done ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
      </button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-500/15 text-[11px] font-bold text-cyan-300">{n}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-100">{title}</div>
        <div className="mt-1 text-xs leading-relaxed text-slate-400">{children}</div>
      </div>
    </div>
  );
}

const b = "font-semibold text-slate-200";

export default function MakeSetup({ configured }: { configured: boolean }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-app";
  const dueUrl = `${origin}/api/scheduler/make/due?limit=10`;
  const resultUrl = `${origin}/api/scheduler/make/result`;

  return (
    <div className="glass-panel p-5 sm:p-6" style={{ boxShadow: "inset 0 0 0 1px rgba(59,130,246,0.25)" }}>
      <h3 className="text-sm font-semibold text-slate-100">Connect Make.com</h3>
      <p className="mt-1 text-xs text-slate-500">
        This page is the calendar. Make.com does the actual posting: every few minutes it asks the app <i>“what is due?”</i>, publishes those posts with its Instagram / Facebook / Threads / TikTok modules, and tells the app how it went.
      </p>

      <div className="mt-5 flex flex-col gap-5">
        <Step n={1} title="Set a shared secret in Vercel">
          Vercel → your project → Settings → Environment Variables → add <span className={b}>SCHEDULER_SECRET</span> with any long random text, then redeploy. Keep it to yourself — you will paste the same text into Make. {configured ? <span className="text-emerald-300">✓ It is set.</span> : <span className="text-amber-300">Not set yet.</span>}
        </Step>

        <Step n={2} title="Make → create a scenario, first module: HTTP → “Make a request”">
          Turn on <span className={b}>Parse response</span>.
          <CopyBox text={dueUrl} />
          Method <span className={b}>GET</span> · add a header <span className={b}>Authorization</span> = <span className={b}>Bearer &lt;your SCHEDULER_SECRET&gt;</span>
        </Step>

        <Step n={3} title="Second module: Iterator over the jobs">
          Array = <span className={b}>jobs</span> (from the HTTP response). Each job is one post going to one account.
          <CopyBox multiline text={`{
  "targetId": "…",          // send this back in step 5
  "platform": "instagram",  // instagram | facebook | threads | tiktok
  "handle": "@son.pawangac",
  "externalId": "17841435173358588",
  "contentType": "reel",    // reel | video | image | carousel | text
  "caption": "…",
  "mediaUrl": "https://…",  // first photo / the video
  "mediaUrls": ["https://…"],
  "client": "Panasonic",
  "scheduledAt": "2026-10-02T03:00:00Z"
}`} />
        </Step>

        <Step n={4} title="Third module: a Router with one route per platform">
          Filter each route on <span className={b}>platform</span>, then pick the publishing module:
          <div className="mt-2 overflow-x-auto rounded-lg border border-white/[0.08]">
            <table className="w-full min-w-[520px] text-[11px]">
              <thead className="bg-white/[0.04] text-left text-slate-500"><tr><th className="px-3 py-2">Platform / content</th><th className="px-3 py-2">Make module</th></tr></thead>
              <tbody className="text-slate-300">
                <tr className="border-t border-white/[0.06]"><td className="px-3 py-2">Instagram · reel</td><td className="px-3 py-2">Instagram for Business → Create a Reel</td></tr>
                <tr className="border-t border-white/[0.06]"><td className="px-3 py-2">Instagram · image</td><td className="px-3 py-2">Instagram for Business → Create a Photo Post</td></tr>
                <tr className="border-t border-white/[0.06]"><td className="px-3 py-2">Instagram · carousel</td><td className="px-3 py-2">Instagram for Business → Create a Carousel Post</td></tr>
                <tr className="border-t border-white/[0.06]"><td className="px-3 py-2">Facebook · video</td><td className="px-3 py-2">Facebook Pages → Upload a Video</td></tr>
                <tr className="border-t border-white/[0.06]"><td className="px-3 py-2">Facebook · image</td><td className="px-3 py-2">Facebook Pages → Create a Photo</td></tr>
                <tr className="border-t border-white/[0.06]"><td className="px-3 py-2">Facebook · text</td><td className="px-3 py-2">Facebook Pages → Create a Post</td></tr>
                <tr className="border-t border-white/[0.06]"><td className="px-3 py-2">Threads</td><td className="px-3 py-2">Threads → Create a Post</td></tr>
                <tr className="border-t border-white/[0.06]"><td className="px-3 py-2">X · text / image / video</td><td className="px-3 py-2">X (Twitter) → Create a Post (photos and video need the upload step first)</td></tr>
                <tr className="border-t border-white/[0.06]"><td className="px-3 py-2">YouTube Shorts · video</td><td className="px-3 py-2">YouTube → Upload a Video (title = <span className={b}>title</span>, description = <span className={b}>caption</span>; vertical and under 3 minutes makes it a Short)</td></tr>
                <tr className="border-t border-white/[0.06]"><td className="px-3 py-2">TikTok</td><td className="px-3 py-2">TikTok → publish a video (check that your Make account offers it)</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">In each module, map the account to <span className={b}>externalId</span> (Instagram account / Facebook Page id), the file to <span className={b}>mediaUrl</span> and the text to <span className={b}>caption</span>. One Facebook connection in Make can cover every Page and Instagram account it can access.</p>
        </Step>

        <Step n={5} title="After each publishing module: report back">
          Add an HTTP → “Make a request” (POST, same Authorization header, <span className={b}>Body type: application/x-www-form-urlencoded</span>) to:
          <CopyBox text={resultUrl} />
          Fields when it worked (add one “Item” per line):
          <CopyBox multiline text={`targetId       = (targetId from the Iterator)
status         = published
platformPostId = (the id the publishing module returns)`} />
          Right-click the publishing module → <span className={b}>Add error handler</span> → same HTTP call with the error, so failures show up here with the reason:
          <CopyBox multiline text={`targetId = (targetId from the Iterator)
status   = failed
error    = (the error message from the error handler)`} />
        </Step>

        <Step n={6} title="Schedule the scenario">
          Run it <span className={b}>every 15 minutes</span> on a paid Make plan, or <span className={b}>every hour</span> on the free plan (1,000 operations a month: an empty check costs 1, a post costs about 3–4). Posts go out at the first check after their time, so this is also your timing precision. Then turn the scenario on — the green “Make connected” badge on this page confirms it is checking in.
        </Step>
      </div>
    </div>
  );
}
