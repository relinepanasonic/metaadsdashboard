"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, Download, Search, RefreshCw, Database, Trash2, Loader2, X, ChevronLeft, ChevronRight, Store, Tag,
} from "lucide-react";
import CustomSelect from "./CustomSelect";
import { parseCsv, buildTemplateCsv, type AudienceRow } from "@/lib/audience";
import { formatNumber } from "@/lib/format";

const ALL = "__all__";
const PAGE_SIZE = 200;

interface Batch {
  id: string;
  label: string;
  row_count: number;
  uploaded_at: string;
}

interface AudienceRecord extends AudienceRow {
  id: string;
  batch_id: string;
  created_at: string;
}

export default function AudienceTable() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [genders, setGenders] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [batch, setBatch] = useState(ALL);
  const [country, setCountry] = useState(ALL);
  const [gender, setGender] = useState(ALL);
  const [branch, setBranch] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [search, setSearch] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [offset, setOffset] = useState(0);

  const [rows, setRows] = useState<AudienceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const loadFacets = useCallback(() => {
    fetch("/api/audience/batches", { cache: "no-store" }).then((r) => r.json()).then((j) => j.ok && setBatches(j.batches));
    fetch("/api/audience/facets", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.ok) {
        setCountries(j.countries);
        setGenders(j.genders);
        setBranches(j.branches);
        setCategories(j.categories);
      }
    });
  }, []);

  useEffect(() => {
    loadFacets();
  }, [loadFacets]);

  const loadRows = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (batch !== ALL) params.set("batch", batch);
    if (country !== ALL) params.set("country", country);
    if (gender !== ALL) params.set("gen", gender);
    if (branch !== ALL) params.set("branch", branch);
    if (category !== ALL) params.set("category", category);
    if (search.trim()) params.set("search", search.trim());
    if (minValue) params.set("min_value", minValue);
    if (maxValue) params.set("max_value", maxValue);
    params.set("offset", String(offset));

    fetch(`/api/audience?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.error);
        setRows(json.rows as AudienceRecord[]);
        setTotal(json.total as number);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [batch, country, gender, branch, category, search, minValue, maxValue, offset]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // Reset to page 1 whenever a filter (not offset) changes.
  useEffect(() => {
    setOffset(0);
  }, [batch, country, gender, branch, category, search, minValue, maxValue]);

  function downloadTemplate() {
    const blob = new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audience_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) throw new Error("No rows found in this CSV.");

      const res = await fetch("/api/audience/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: file.name.replace(/\.csv$/i, ""), rows: parsed }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      flash(`Uploaded ${json.count} records.`);
      loadFacets();
      loadRows();
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deleteBatch(id: string, label: string) {
    if (!window.confirm(`Delete batch "${label}" and all its records? This cannot be undone.`)) return;
    await fetch(`/api/audience/batches/${id}`, { method: "DELETE" });
    flash(`Batch "${label}" deleted.`);
    if (batch === id) setBatch(ALL);
    loadFacets();
    loadRows();
  }

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-300" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(52,211,153,0.4)" }}>
          {toast}
        </div>
      )}

      {/* Upload panel */}
      <div className="glass-panel p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-200">Upload Audience CSV</h3>
        <p className="mb-4 text-xs text-slate-500">
          Matches your internal template — Branch/Category/Product + Meta&apos;s value-based audience fields.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
            style={{ boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.4)" }}
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? "Uploading…" : "Upload CSV"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.1]"
          >
            <Download size={13} /> Download Template
          </button>
        </div>
        {uploadError && <p className="mt-2 text-xs text-rose-400">{uploadError}</p>}

        {batches.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5 border-t border-white/[0.06] pt-4">
            {batches.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2 text-xs">
                <Database size={12} className="text-slate-500" />
                <span className="font-semibold text-slate-200">{b.label}</span>
                <span className="text-slate-500">{formatNumber(b.row_count)} records</span>
                <span className="ml-auto text-slate-600">{new Date(b.uploaded_at).toLocaleString("id-ID")}</span>
                <button
                  onClick={() => deleteBatch(b.id, b.label)}
                  className="flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/20"
                >
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters + table */}
      <div className="glass-panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Database size={14} className="text-slate-500 shrink-0" />
            <CustomSelect
              className="min-w-[150px]"
              value={batch}
              onChange={setBatch}
              options={[{ value: ALL, label: "All Batches" }, ...batches.map((b) => ({ value: b.id, label: b.label }))]}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Store size={14} className="text-slate-500 shrink-0" />
            <CustomSelect
              className="min-w-[140px]"
              value={branch}
              onChange={setBranch}
              options={[{ value: ALL, label: "All Branches" }, ...branches.map((b) => ({ value: b, label: b }))]}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Tag size={14} className="text-slate-500 shrink-0" />
            <CustomSelect
              className="min-w-[140px]"
              value={category}
              onChange={setCategory}
              options={[{ value: ALL, label: "All Categories" }, ...categories.map((c) => ({ value: c, label: c }))]}
            />
          </div>
          <CustomSelect
            className="min-w-[130px]"
            value={country}
            onChange={setCountry}
            options={[{ value: ALL, label: "All Countries" }, ...countries.map((c) => ({ value: c, label: c }))]}
          />
          <CustomSelect
            className="min-w-[120px]"
            value={gender}
            onChange={setGender}
            options={[{ value: ALL, label: "All Genders" }, ...genders.map((g) => ({ value: g, label: g }))]}
          />
          <input
            value={minValue}
            onChange={(e) => setMinValue(e.target.value)}
            placeholder="Min value"
            type="number"
            className="w-[100px] rounded-lg border border-white/[0.1] bg-[#0b0e14] px-3 py-2 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none"
          />
          <input
            value={maxValue}
            onChange={(e) => setMaxValue(e.target.value)}
            placeholder="Max value"
            type="number"
            className="w-[100px] rounded-lg border border-white/[0.1] bg-[#0b0e14] px-3 py-2 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none"
          />
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, UID…"
              className="w-[220px] rounded-lg border border-white/[0.1] bg-[#0b0e14] py-2 pl-9 pr-8 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={loadRows}
            className="flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.1]"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-cyan-400" : ""} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg px-4 py-3 text-xs text-amber-300" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.3)" }}>
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[2200px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="sticky left-0 bg-[#0e1420] px-3 py-2.5 font-semibold">Name</th>
                <th className="px-3 py-2.5 font-semibold">Branch</th>
                <th className="px-3 py-2.5 font-semibold">Branch City</th>
                <th className="px-3 py-2.5 font-semibold">Category</th>
                <th className="px-3 py-2.5 font-semibold">Product</th>
                <th className="px-3 py-2.5 font-semibold">Email</th>
                <th className="px-3 py-2.5 font-semibold">Phone</th>
                <th className="px-3 py-2.5 font-semibold">First Name</th>
                <th className="px-3 py-2.5 font-semibold">Last Name</th>
                <th className="px-3 py-2.5 font-semibold">City</th>
                <th className="px-3 py-2.5 font-semibold">Province</th>
                <th className="px-3 py-2.5 font-semibold">Country</th>
                <th className="px-3 py-2.5 font-semibold">ZIP</th>
                <th className="px-3 py-2.5 font-semibold">DOB</th>
                <th className="px-3 py-2.5 text-right font-semibold">Age</th>
                <th className="px-3 py-2.5 font-semibold">Gender</th>
                <th className="px-3 py-2.5 font-semibold">MADID</th>
                <th className="px-3 py-2.5 font-semibold">UID</th>
                <th className="px-3 py-2.5 text-right font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={19} className="px-3 py-10 text-center text-slate-500">
                  <RefreshCw size={16} className="mx-auto mb-2 animate-spin text-cyan-400" />Loading audience…
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={19} className="px-3 py-10 text-center text-slate-500">
                  No records yet. Upload a CSV above to get started.
                </td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                    <td className="sticky left-0 max-w-[180px] truncate bg-[#0b0e14] px-3 py-2 font-medium text-slate-100" title={r.full_name}>{r.full_name || "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{r.branch_name || "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{r.branch_city || "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{r.category || "—"}</td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-slate-300" title={r.product}>{r.product || "—"}</td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-slate-300" title={r.email1}>{r.email1 || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-300">{r.phone1 || "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{r.fn || "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{r.ln || "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{r.ct || "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{r.st || "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{r.country || "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{r.zip || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-300">{r.dob || "—"}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{r.age ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{r.gen || "—"}</td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-slate-500" title={r.madid}>{r.madid || "—"}</td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-slate-500" title={r.uid}>{r.uid || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-300">{r.value != null ? formatNumber(r.value) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {from}–{to} of {formatNumber(total)} records</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                className="flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 hover:bg-white/[0.1] disabled:opacity-30"
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={to >= total}
                className="flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 hover:bg-white/[0.1] disabled:opacity-30"
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
