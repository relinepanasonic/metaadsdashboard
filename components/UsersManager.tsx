"use client";

import { useEffect, useMemo, useState } from "react";
import {
  UserPlus, Copy, Ban, RotateCcw, KeyRound, Check, Loader2, ShieldCheck, Megaphone, UserRound as ClientIcon,
} from "lucide-react";
import CustomSelect from "./CustomSelect";
import type { MetaAccount } from "@/lib/services/types";

interface AppUserRow {
  id: string;
  username: string;
  email: string;
  role: "superadmin" | "advertiser" | "client";
  client_name: string | null;
  adAccountIds: string[];
  created_at: string;
}
interface InviteRow {
  token: string;
  role: "advertiser" | "client";
  client_name: string | null;
  ad_account_ids: string[] | null;
  label: string | null;
  status: "pending" | "completed" | "revoked";
  created_at: string;
  expires_at: string;
}

const ROLE_BADGE: Record<string, { icon: typeof ShieldCheck; cls: string }> = {
  superadmin: { icon: ShieldCheck, cls: "bg-violet-500/15 text-violet-300" },
  advertiser: { icon: Megaphone, cls: "bg-cyan-500/15 text-cyan-300" },
  client: { icon: ClientIcon, cls: "bg-emerald-500/15 text-emerald-300" },
};

export default function UsersManager({ myRole }: { myRole: string }) {
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // New-invite form state
  const [newRole, setNewRole] = useState<"advertiser" | "client">("client");
  const [newClient, setNewClient] = useState("");
  const [newClientCustom, setNewClientCustom] = useState("");
  const [newAccounts, setNewAccounts] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const [u, i, a, c] = await Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/invites").then((r) => r.json()),
      fetch("/api/meta/accounts").then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()),
    ]);
    if (u.ok) setUsers(u.users);
    if (i.ok) setInvites(i.invites);
    if (a.ok) setAccounts(a.accounts);
    if (c.ok) setClients(c.clients);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function createInvite() {
    setCreating(true);
    setCreateError(null);
    const clientName = newClient === "__custom__" ? newClientCustom.trim() : newClient;
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: newRole,
          clientName: newRole === "client" ? clientName : undefined,
          adAccountIds: newRole === "advertiser" ? newAccounts : undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${json.token}`);
      flash("Invite link copied to clipboard!");
      setNewClient("");
      setNewClientCustom("");
      setNewAccounts([]);
      loadAll();
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 1500);
  }

  async function revoke(token: string) {
    await fetch(`/api/invites/${token}`, { method: "DELETE" });
    loadAll();
  }

  async function regenerate(token: string) {
    await fetch(`/api/invites/${token}/regenerate`, { method: "POST" });
    await copyLink(token);
    flash("Link renewed and copied!");
    loadAll();
  }

  async function sendReset(email: string) {
    await fetch("/api/users/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    flash(`Reset link sent to ${email}`);
  }

  const clientOptions = useMemo(
    () => [...clients.map((c) => ({ value: c, label: c })), { value: "__custom__", label: "＋ New client…" }],
    [clients]
  );

  const canInviteAdvertiser = myRole === "superadmin";

  return (
    <div className="flex flex-col gap-5">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-300" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(52,211,153,0.4)" }}>
          {toast}
        </div>
      )}

      {/* Create invite */}
      <div className="glass-panel p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-200">Invite a new user</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-500">Role</label>
            <CustomSelect
              className="min-w-[140px]"
              value={newRole}
              onChange={(v) => setNewRole(v as "advertiser" | "client")}
              options={[
                { value: "client", label: "Client" },
                ...(canInviteAdvertiser ? [{ value: "advertiser", label: "Advertiser" }] : []),
              ]}
            />
          </div>

          {newRole === "client" ? (
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-500">Client</label>
              <CustomSelect className="min-w-[160px]" value={newClient} onChange={setNewClient} placeholder="Choose client" options={clientOptions} />
              {newClient === "__custom__" && (
                <input
                  value={newClientCustom}
                  onChange={(e) => setNewClientCustom(e.target.value)}
                  placeholder="New client name"
                  className="mt-2 w-full rounded-lg border border-white/[0.12] bg-[#0b0e14] px-3 py-2 text-xs text-slate-100 focus:border-cyan-500/50 focus:outline-none"
                />
              )}
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-500">Ad Accounts</label>
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/[0.12] bg-[#0b0e14] p-2">
                {accounts.map((a) => {
                  const active = newAccounts.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setNewAccounts((prev) => (active ? prev.filter((x) => x !== a.id) : [...prev, a.id]))}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        active ? "bg-cyan-500/20 text-cyan-300" : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
                      }`}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={createInvite}
            disabled={creating || (newRole === "client" ? !(newClient === "__custom__" ? newClientCustom.trim() : newClient) : newAccounts.length === 0)}
            className="flex items-center gap-2 rounded-lg bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
          >
            {creating ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
            Create Invite Link
          </button>
        </div>
        {createError && <p className="mt-2 text-xs text-rose-400">{createError}</p>}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="glass-panel p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Invite links</h3>
          <div className="flex flex-col gap-2">
            {invites.map((inv) => {
              const expired = new Date(inv.expires_at) < new Date();
              const badge = ROLE_BADGE[inv.role];
              const Icon = badge.icon;
              return (
                <div key={inv.token} className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2.5">
                  <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                    <Icon size={11} />
                    {inv.role === "client" ? inv.client_name : "Advertiser"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {inv.status === "pending" && !expired && "Pending"}
                    {inv.status === "pending" && expired && "Expired"}
                    {inv.status === "completed" && "Completed"}
                    {inv.status === "revoked" && "Revoked"}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {inv.status === "pending" && !expired && (
                      <>
                        <button onClick={() => copyLink(inv.token)} className="flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.1]">
                          {copiedToken === inv.token ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          Copy
                        </button>
                        <button onClick={() => revoke(inv.token)} className="flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/20">
                          <Ban size={11} /> Revoke
                        </button>
                      </>
                    )}
                    {(inv.status !== "pending" || expired) && (
                      <button onClick={() => regenerate(inv.token)} className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300 hover:bg-amber-500/20">
                        <RotateCcw size={11} /> Recreate link
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Existing users */}
      <div className="glass-panel p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Users</h3>
        {loading ? (
          <p className="py-6 text-center text-xs text-slate-500">Loading…</p>
        ) : users.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">No users yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map((u) => {
              const badge = ROLE_BADGE[u.role];
              const Icon = badge.icon;
              return (
                <div key={u.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2.5">
                  <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                    <Icon size={11} />
                    {u.role}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-slate-100">{u.username}</div>
                    <div className="text-[10px] text-slate-500">{u.email}</div>
                  </div>
                  {u.client_name && <span className="text-[11px] text-slate-400">→ {u.client_name}</span>}
                  {u.adAccountIds?.length > 0 && (
                    <span className="text-[11px] text-slate-400">
                      → {u.adAccountIds.map((id) => accounts.find((a) => a.id === id)?.name ?? id).join(", ")}
                    </span>
                  )}
                  <button
                    onClick={() => sendReset(u.email)}
                    className="ml-auto flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.1]"
                  >
                    <KeyRound size={11} /> Send reset link
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
