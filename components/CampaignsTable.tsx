"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Building2, Wallet2, UserRound } from "lucide-react";
import type { MetaAccount, CampaignTableRow } from "@/lib/services/types";
import { formatIDR, formatNumber } from "@/lib/format";
import CustomSelect from "./CustomSelect";

const ALL = "__all__";

export default function CampaignsTable() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [account, setAccount] = useState<string>("");
  const [business, setBusiness] = useState<string>(ALL);
  const [client, setClient] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<CampaignTableRow[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load accounts + client roster once.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/meta/accounts", { cache: "no-store" });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
        setAccounts(json.accounts as MetaAccount[]);
        if (json.accounts[0]) setAccount(json.accounts[0].id);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    fetch("/api/clients", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setRoster(j.clients as string[]))
      .catch(() => {});
  }, []);

  // Assign a campaign to a client (optimistic + persist to Supabase).
  async function assignClient(campaignId: string, clientName: string) {
    setRows((prev) => prev.map((r) => (r.id === campaignId ? { ...r, client: clientName || "Unassigned" } : r)));
    if (clientName && !roster.includes(clientName)) setRoster((r) => [...r, clientName].sort());
    try {
      await fetch("/api/meta/assign-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, accountId: account, clientName }),
      });
    } catch {
      /* keep optimistic value; will reconcile on next load */
    }
  }

  async function handleClientChange(campaignId: string, value: string) {
    await assignClient(campaignId, value === "Unassigned" ? "" : value);
  }

  // Load campaigns when account changes.
  useEffect(() => {
    if (!account) return;
    setLoading(true);
    setError(null);
    fetch(`/api/meta/campaigns?account=${account}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.error);
        setRows(json.campaigns as CampaignTableRow[]);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [account]);

  const businesses = useMemo(() => {
    const set = new Set(accounts.map((a) => a.business || "Other"));
    return Array.from(set);
  }, [accounts]);

  const visibleAccounts = useMemo(
    () => (business === ALL ? accounts : accounts.filter((a) => (a.business || "Other") === business)),
    [accounts, business]
  );

  const clients = useMemo(() => {
    const set = new Set(rows.map((r) => r.client));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (client !== ALL && r.client !== client) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.client.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [rows, client, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (a, r) => ({ spend: a.spend + r.spend, results: a.results + r.results, impressions: a.impressions + r.impressions }),
      { spend: 0, results: 0, impressions: 0 }
    );
  }, [filtered]);

  return (
    <div className="glass-panel p-4 sm:p-5">
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Building2 size={14} className="text-slate-500 shrink-0" />
          <CustomSelect
            className="min-w-[160px]"
            value={business}
            onChange={setBusiness}
            options={[{ value: ALL, label: "All Businesses" }, ...businesses.map((b) => ({ value: b, label: b }))]}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Wallet2 size={14} className="text-slate-500 shrink-0" />
          <CustomSelect
            className="min-w-[170px]"
            value={account}
            onChange={setAccount}
            options={visibleAccounts.map((a) => ({ value: a.id, label: a.name }))}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <UserRound size={14} className="text-slate-500 shrink-0" />
          <CustomSelect
            className="min-w-[150px]"
            value={client}
            onChange={setClient}
            options={[{ value: ALL, label: "All Clients" }, ...clients.map((c) => ({ value: c, label: c }))]}
          />
        </div>
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaign or client…"
            className="w-[220px] rounded-lg border border-white/[0.1] bg-[#0b0e14] py-2 pl-9 pr-3 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg px-4 py-3 text-xs text-amber-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="sticky left-0 bg-[#0e1420] px-3 py-2.5 font-semibold">Client</th>
              <th className="px-3 py-2.5 font-semibold">Campaign</th>
              <th className="px-3 py-2.5 font-semibold">Delivery</th>
              <th className="px-3 py-2.5 text-right font-semibold">Results</th>
              <th className="px-3 py-2.5 text-right font-semibold">Cost / Result</th>
              <th className="px-3 py-2.5 text-right font-semibold">Budget</th>
              <th className="px-3 py-2.5 text-right font-semibold">Spent</th>
              <th className="px-3 py-2.5 text-right font-semibold">Impressions</th>
              <th className="px-3 py-2.5 text-right font-semibold">Reach</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                <RefreshCw size={16} className="mx-auto mb-2 animate-spin text-cyan-400" />Loading campaigns…
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-500">No campaigns match these filters.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                  <td className="sticky left-0 bg-[#0b0e14] px-3 py-2.5">
                    <CustomSelect
                      size="sm"
                      className="min-w-[140px]"
                      value={r.client}
                      onChange={(v) => handleClientChange(r.id, v)}
                      allowAddNew
                      onAddNew={(name) => assignClient(r.id, name)}
                      options={[
                        { value: "Unassigned", label: "Unassigned" },
                        ...(!roster.includes(r.client) && r.client !== "Unassigned" ? [{ value: r.client, label: r.client, accent: true }] : []),
                        ...roster.map((c) => ({ value: c, label: c, accent: c === r.client })),
                      ]}
                    />
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-2.5 font-medium text-slate-100" title={r.name}>{r.name}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-slate-300">
                      <span className={`h-1.5 w-1.5 rounded-full ${r.delivery === "Active" ? "bg-emerald-400" : "bg-slate-600"}`} />
                      {r.delivery}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {r.results > 0 ? (
                      <div>
                        <div className="font-semibold text-slate-100">{formatNumber(r.results)}</div>
                        <div className="text-[10px] text-slate-500">{r.resultLabel}</div>
                      </div>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-300">{r.costPerResult > 0 ? formatIDR(r.costPerResult, false) : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-slate-300">
                    {r.dailyBudget > 0 ? <span>{formatIDR(r.dailyBudget, false)}<span className="text-[10px] text-slate-500"> /day</span></span>
                      : r.lifetimeBudget > 0 ? formatIDR(r.lifetimeBudget, false) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-slate-100">{r.spend > 0 ? formatIDR(r.spend, false) : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-slate-300">{r.impressions > 0 ? formatNumber(r.impressions) : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-slate-300">{r.reach > 0 ? formatNumber(r.reach) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-white/[0.1] text-[11px] font-semibold text-slate-200">
                <td className="sticky left-0 bg-[#0e1420] px-3 py-2.5" colSpan={3}>{filtered.length} campaigns</td>
                <td className="px-3 py-2.5 text-right">{formatNumber(totals.results)}</td>
                <td className="px-3 py-2.5"></td>
                <td className="px-3 py-2.5"></td>
                <td className="px-3 py-2.5 text-right">{formatIDR(totals.spend, false)}</td>
                <td className="px-3 py-2.5 text-right">{formatNumber(totals.impressions)}</td>
                <td className="px-3 py-2.5"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
