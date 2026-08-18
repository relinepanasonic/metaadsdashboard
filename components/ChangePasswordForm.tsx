"use client";

import { useState } from "react";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const inputCls =
  "w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none";

export default function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw new Error(err.message);
      setDone(true);
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-panel max-w-sm p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">Change Password</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <div className="rounded-lg px-3 py-2 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
            {error}
          </div>
        )}
        {done && (
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-emerald-300" style={{ boxShadow: "inset 0 0 0 1px rgba(52,211,153,0.3)" }}>
            <CheckCircle2 size={13} /> Password updated.
          </div>
        )}
        <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" />
        <input className={inputCls} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500/15 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
          style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          {loading ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}
