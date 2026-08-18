"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/auth/AuthCard";

const inputCls =
  "w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw new Error(err.message);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a reset link">
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <CheckCircle2 size={28} className="text-emerald-400" />
          <p className="text-sm text-slate-300">
            If an account exists for <span className="font-semibold text-slate-100">{email}</span>, a reset link is on its way.
          </p>
          <Link href="/login" className="mt-2 text-xs text-cyan-400 hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {error && (
            <div className="rounded-lg px-3 py-2 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
              {error}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-slate-400">Email</label>
            <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus required />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-cyan-500/15 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
            {loading ? "Sending…" : "Send Reset Link"}
          </button>
          <Link href="/login" className="mt-1 flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300">
            <ArrowLeft size={12} /> Back to sign in
          </Link>
        </form>
      )}
    </AuthCard>
  );
}
