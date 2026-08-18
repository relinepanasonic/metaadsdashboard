"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";

const inputCls =
  "w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/bootstrap")
      .then((r) => r.json())
      .then((j) => setBlocked(!j.needsSetup))
      .finally(() => setChecking(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      router.push("/login");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <AuthCard title="Initial Setup" subtitle="Checking setup status…">
        <p className="text-center text-xs text-slate-500">One moment…</p>
      </AuthCard>
    );
  }

  if (blocked) {
    return (
      <AuthCard title="Setup already complete" subtitle="A Superadmin account already exists">
        <p className="text-center text-xs text-slate-400">
          Ask your Superadmin for an invite link, or go to{" "}
          <a href="/login" className="text-cyan-400 hover:underline">sign in</a>.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create the first Superadmin" subtitle="One-time setup for this dashboard">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {error && (
          <div className="rounded-lg px-3 py-2 text-xs text-rose-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,113,133,0.3)" }}>
            {error}
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
          disabled={loading}
          className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-cyan-500/15 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
          style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          {loading ? "Creating…" : "Create Superadmin"}
        </button>
      </form>
    </AuthCard>
  );
}
