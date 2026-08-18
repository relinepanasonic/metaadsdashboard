"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { UserPlus, Loader2, CheckCircle2, XCircle } from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";

const inputCls =
  "w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none";

interface InviteInfo {
  role: "advertiser" | "client";
  client_name: string | null;
  label: string | null;
}

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(async (r) => {
        const j = await r.json();
        if (!j.ok) throw new Error(j.error);
        setInvite(j.invite);
      })
      .catch((e) => setLoadError((e as Error).message))
      .finally(() => setLoadingInvite(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username, email, password }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setNeedsConfirm(Boolean(json.requiresEmailConfirm));
      setDone(true);
      if (!json.requiresEmailConfirm) {
        setTimeout(() => router.push("/login"), 1800);
      }
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingInvite) {
    return (
      <AuthCard title="Accept Invitation" subtitle="Checking your invite…">
        <p className="text-center text-xs text-slate-500">One moment…</p>
      </AuthCard>
    );
  }

  if (loadError || !invite) {
    return (
      <AuthCard title="Invite unavailable" subtitle="">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <XCircle size={26} className="text-rose-400" />
          <p className="text-sm text-slate-300">{loadError}</p>
        </div>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Account created" subtitle="">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <CheckCircle2 size={28} className="text-emerald-400" />
          <p className="text-sm text-slate-300">
            {needsConfirm
              ? "Check your email to confirm your account, then sign in."
              : "Redirecting you to sign in…"}
          </p>
        </div>
      </AuthCard>
    );
  }

  const roleLabel = invite.role === "advertiser" ? "Advertiser" : `Client — ${invite.client_name}`;

  return (
    <AuthCard title="You're invited" subtitle={`Set up your ${roleLabel} account`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {submitError && (
          <div className="rounded-lg px-3 py-2 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
            {submitError}
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-slate-400">Username</label>
          <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-slate-400">Email</label>
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-slate-400">Password</label>
          <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-cyan-500/15 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
          style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
          {submitting ? "Creating account…" : "Create Account"}
        </button>
      </form>
    </AuthCard>
  );
}
