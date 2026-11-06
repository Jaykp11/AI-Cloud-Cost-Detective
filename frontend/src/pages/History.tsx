import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock3, LoaderCircle, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { analysisApi, getApiErrorMessage } from "../lib/api";
import type { AnalysisRecord } from "../lib/types";

function currency(value: unknown): string {
  if (value === null || value === undefined || value === "" || value === "Not estimated") return "Not estimated";
  const parsed = Number(String(value).replace(/[$,A-Z\s]/g, ""));
  return Number.isFinite(parsed) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(parsed) : String(value);
}
function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : parsed.toLocaleString();
}
function statusStyle(status: string) {
  if (status === "completed") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  if (status === "failed") return "border-red-400/20 bg-red-400/10 text-red-300";
  return "border-amber-400/20 bg-amber-400/10 text-amber-300";
}

export default function History() {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setRecords(await analysisApi.getHistory(100)); }
    catch (err) { setError(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = records.filter((item) => `${item.region} ${item.status} ${item.id}`.toLowerCase().includes(query.toLowerCase()));

  return <section className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Your workspace</p><h1 className="mt-2 text-3xl font-semibold text-white">Analysis history</h1><p className="mt-2 text-sm text-gray-400">Reopen saved reports and review your AWS optimization findings.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Refresh</button>
    </div>
    <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#111713] px-4 py-3"><Search size={17} className="text-gray-500"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by region, status, or analysis ID" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-600"/></label>
    {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</div>}
    {loading ? <div className="flex justify-center gap-3 p-12 text-sm text-gray-400"><LoaderCircle className="animate-spin" size={18}/> Loading saved analyses…</div> : filtered.length === 0 ? <div className="rounded-2xl border border-white/10 bg-[#111713] p-12 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-gray-500"/><h2 className="mt-4 font-semibold text-white">{records.length ? "No matching analyses" : "No analyses yet"}</h2><p className="mt-2 text-sm text-gray-400">{records.length ? "Try a different search term." : "Run your first analysis from the dashboard to see it here."}</p><Link to="/dashboard" className="mt-5 inline-flex rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#0b100e]">Go to dashboard</Link></div> :
      <div className="space-y-3">{filtered.map((record) => <Link key={record.id} to={`/report/${record.id}`} className="group block rounded-2xl border border-white/[0.08] bg-[#111713] p-5 transition hover:border-emerald-400/30 hover:bg-[#141d17] sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-white">{record.region || "AWS analysis"}</h2><span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${statusStyle(record.status)}`}>{record.status.replace("_", " ")}</span></div><p className="mt-2 flex items-center gap-2 text-xs text-gray-500"><Clock3 size={13}/>{date(record.created_at)}</p><p className="mt-2 truncate font-mono text-xs text-gray-600">ID: {record.id}</p></div>
          <div className="grid grid-cols-3 gap-5 sm:min-w-[360px]"><div><p className="text-xs text-gray-500">Resources</p><p className="mt-1 text-lg font-semibold text-white">{record.resources_scanned ?? 0}</p></div><div><p className="text-xs text-gray-500">Issues</p><p className="mt-1 text-lg font-semibold text-white">{record.issues_found ?? 0}</p></div><div><p className="text-xs text-gray-500">Monthly savings</p><p className="mt-1 text-sm font-semibold text-emerald-300">{currency(record.estimated_savings)}</p></div></div>
          <ArrowUpRight size={18} className="hidden shrink-0 text-gray-500 transition group-hover:text-emerald-300 sm:block"/>
        </div>
      </Link>)}</div>}
  </section>;
}
