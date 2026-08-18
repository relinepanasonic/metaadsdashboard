"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/auth/AuthCard";

const inputCls =
  "w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase's recovery link puts a temporary session in the URL hash; the
  // browser client parses it automatically once mounted.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Fallback: if a session already exists (e.g. hash already parsed), allow it.
    supabase.auth.getSession().then(({ data }) => data.session && setReady(true));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw new Error(err.message);
      setDone(true);
      setTimeout(() => router.push("/login"), 1800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Set a new password" subtitle="Choose a strong password for your account">
      {done ? (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <CheckCircle2 size={28} className="text-emerald-400" />
          <p className="text-sm text-slate-300">Password updated. Redirecting to sign in…</p>
        </div>
      ) : !ready ? (
        <p className="py-4 text-center text-xs text-slate-500">Validating your reset link…</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {error && (
            <div className="rounded-lg px-3 py-2 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
              {error}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-slate-400">New Password</label>
            <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoFocus required />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-slate-400">Confirm Password</label>
            <input className={inputCls} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-cyan-500/15 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            {loading ? "Updating…" : "Update Password"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
