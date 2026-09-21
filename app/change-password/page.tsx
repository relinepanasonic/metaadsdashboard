"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/auth/AuthCard";
import PasswordInput from "@/components/auth/PasswordInput";

const inputCls =
  "w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none";

// Where accounts created with a temporary password are sent on first sign-in.
// Until the password is replaced, the rest of the app and its API stay locked
// (see lib/supabase/middleware.ts and lib/auth/currentUser.ts).
export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (/^(.)\1+$/.test(password) || password === "12345678") return setError("That password is too easy to guess — pick something less predictable.");
    if (password !== confirm) return setError("The two passwords don't match.");

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
      if (err) throw new Error(err.message);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <AuthCard title="Choose your own password" subtitle="Your account was set up with a temporary password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {error && (
          <div className="rounded-lg px-3 py-2 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
            {error}
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-slate-400">New password</label>
          <PasswordInput className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoFocus required />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-slate-400">Confirm new password</label>
          <PasswordInput className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat it" required />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-cyan-500/15 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
          style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          {loading ? "Saving…" : "Save and continue"}
        </button>
        <button type="button" onClick={signOut} className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300">
          <LogOut size={12} /> Sign out
        </button>
      </form>
    </AuthCard>
  );
}
