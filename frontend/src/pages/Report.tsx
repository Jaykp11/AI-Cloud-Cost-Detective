import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Clipboard, Cloud, LoaderCircle, ShieldAlert, Terminal } from "lucide-react";
import { analysisApi, getApiErrorMessage } from "../lib/api";
import type { AnalysisIssue, AnalysisRecord, AnalysisResult } from "../lib/types";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function getResult(record: AnalysisRecord): AnalysisResult {
  const stored = asObject(record.analysis_result);
  const nested = asObject(stored.analysis);
  return (Object.keys(nested).length ? nested : stored) as AnalysisResult;
}
function amount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value.replace(/^[A-Z]{3}\s+/i, "").replace(/[,$\s]/g, "");
    if (Number.isFinite(Number(normalized))) return Number(normalized);
  }
  if (value && typeof value === "object" && "amount" in value) return amount((value as { amount?: unknown }).amount);
  return null;
}
function money(value: number | null): string {
  return value === null ? "Not estimated" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}
function severityClass(severity: string) {
  switch (severity.toLowerCase()) {
    case "high": case "critical": return "border-red-400/25 bg-red-400/10 text-red-300";
    case "medium": return "border-yellow-400/25 bg-yellow-400/10 text-yellow-200";
    default: return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
  }
}
function categoryLabel(category: unknown): string {
  const raw = String(category ?? "optimization").toLowerCase();
  if (raw.includes("unused") || raw.includes("idle")) return "Unused";
  if (raw.includes("misconfig") || raw.includes("security")) return "Misconfigured";
  if (raw.includes("over") || raw.includes("provision")) return "Over-provisioned";
  return raw.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function commandsFor(issue: AnalysisIssue): string[] {
  const commands = issue.remediation_commands ?? issue.fix_commands;
  return Array.isArray(commands) ? commands.filter((command): command is string => typeof command === "string" && command.trim().length > 0) : [];
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(command); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
    catch { setCopied(false); }
  }
  return <div className="overflow-hidden rounded-xl border border-white/10 bg-[#090d0b]"><div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2"><span className="flex items-center gap-2 text-xs text-gray-500"><Terminal size={13}/> Suggested AWS CLI command</span><button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-emerald-300 hover:bg-white/5">{copied ? <Check size={13}/> : <Clipboard size={13}/>} {copied ? "Copied" : "Copy"}</button></div><pre className="overflow-x-auto whitespace-pre-wrap break-all p-4 text-xs leading-6 text-emerald-100"><code>{command}</code></pre></div>;
}

export default function Report() {
  const { analysisId = "" } = useParams();
  const [record, setRecord] = useState<AnalysisRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!analysisId) { setError("Missing analysis ID."); setLoading(false); return; }
    setLoading(true); setError("");
    try { setRecord(await analysisApi.getHistoryItem(analysisId)); }
    catch (err) { setError(getApiErrorMessage(err, "Could not load this report.")); }
    finally { setLoading(false); }
  }, [analysisId]);
  useEffect(() => { void load(); }, [load]);

  const result = useMemo(() => record ? getResult(record) : {}, [record]);
  const issues = Array.isArray(result.issues) ? result.issues as AnalysisIssue[] : [];
  const savings = amount(result.estimated_monthly_savings) ?? amount(record?.estimated_savings);
  const summary = typeof result.summary === "string" ? result.summary : "Review the findings below for resource-specific optimization opportunities.";

  if (loading) return <div className="flex justify-center gap-3 p-16 text-sm text-gray-400"><LoaderCircle className="animate-spin" size={18}/> Loading report…</div>;
  if (error || !record) return <section className="rounded-2xl border border-red-400/20 bg-red-400/5 p-8"><p className="text-red-200">{error || "Report not found."}</p><Link to="/history" className="mt-5 inline-flex items-center gap-2 text-sm text-emerald-300"><ArrowLeft size={15}/> Back to history</Link></section>;

  return <section className="space-y-7">
    <Link to="/history" className="inline-flex items-center gap-2 text-sm text-gray-400 transition hover:text-white"><ArrowLeft size={16}/> Back to history</Link>
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Analysis report</p><h1 className="mt-2 text-3xl font-semibold text-white">AWS optimization findings</h1><p className="mt-2 text-sm text-gray-400">Region: <span className="text-gray-200">{record.region}</span> · {new Date(record.created_at).toLocaleString()}</p></div><span className={`w-fit rounded-full border px-3 py-1.5 text-xs capitalize ${record.status === "completed" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : record.status === "failed" ? "border-red-400/20 bg-red-400/10 text-red-300" : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}>{record.status.replace("_", " ")}</span></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[{ label: "Resources scanned", value: String(record.resources_scanned ?? 0), icon: Cloud }, { label: "Issues found", value: String(record.issues_found ?? issues.length), icon: ShieldAlert }, { label: "Monthly savings", value: money(savings), icon: Cloud }, { label: "Yearly savings", value: money(savings === null ? null : savings * 12), icon: Cloud }].map((card) => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl border border-white/[0.08] bg-[#111713] p-5"><div className="flex items-center justify-between"><p className="text-sm text-gray-400">{card.label}</p><Icon size={18} className="text-emerald-300"/></div><p className="mt-4 text-2xl font-semibold text-white">{card.value}</p></article>; })}
    </section>
    <section className="rounded-2xl border border-white/[0.08] bg-[#111713] p-5 sm:p-6"><h2 className="font-semibold text-white">AI summary</h2><p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-300">{summary}</p><p className="mt-3 text-xs text-gray-500">Savings are estimates, not guaranteed reductions. Review each recommendation and its approval requirements before executing commands.</p></section>
    <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">Issues and recommendations</h2><p className="mt-1 text-sm text-gray-500">Commands are suggestions only and are never executed by this app.</p></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-300">{issues.length} {issues.length === 1 ? "finding" : "findings"}</span></div>
    {issues.length === 0 ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-8 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-emerald-300"/><h3 className="mt-3 font-semibold text-white">No actionable issues returned</h3><p className="mt-2 text-sm text-gray-400">The analysis did not identify optimization findings from the available resource data.</p></div> : <div className="space-y-4">{issues.map((issue, index) => { const commands = commandsFor(issue); const resource = issue.resource_id ?? issue.resource ?? "Resource identifier not provided"; const description = issue.finding ?? issue.description ?? "No additional explanation was returned."; return <article key={`${resource}-${index}`} className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#111713] p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-white">{issue.title ?? `Finding ${index + 1}`}</h3><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${severityClass(String(issue.severity ?? "low"))}`}>{String(issue.severity ?? "low").toUpperCase()}</span><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-300">{categoryLabel(issue.category)}</span></div><p className="mt-3 break-all font-mono text-xs text-gray-500">{String(resource)}{issue.resource_type ? ` · ${issue.resource_type}` : ""}</p></div><p className="shrink-0 text-sm font-semibold text-emerald-300">{money(amount(issue.estimated_monthly_savings))}/mo</p></div><p className="text-sm leading-6 text-gray-300">{description}</p>{Array.isArray(issue.evidence) && issue.evidence.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-gray-400">{issue.evidence.map((item, evidenceIndex) => <li key={evidenceIndex}>{String(item)}</li>)}</ul>}<div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Recommendation</p><p className="mt-2 text-sm leading-6 text-gray-300">{issue.recommendation ?? "Review the resource configuration and confirm the appropriate remediation."}</p></div>{commands.length > 0 ? <div className="space-y-3">{commands.map((command, commandIndex) => <CopyCommand key={`${commandIndex}-${command}`} command={command}/>)}</div> : <p className="rounded-xl border border-white/[0.07] p-4 text-xs text-gray-500">No safe remediation command was provided for this finding.</p>}{issue.requires_approval && <p className="text-xs text-amber-200">Review and approve this change before running the suggested command.</p>}</article>; })}</div>}
    <p className="break-all text-xs text-gray-600">Analysis ID: {record.id}</p>
  </section>;
}
