import { CheckCircle2, Circle, LoaderCircle, XCircle } from "lucide-react";
import type { ProgressUpdate } from "../lib/types";

interface ProgressTrackerProps {
  updates: ProgressUpdate[];
  status: "pending" | "in_progress" | "completed" | "failed";
}

const plannedSteps = [
  { key: "cost", label: "Querying AWS Cost Explorer", matches: ["cost explorer", "querying aws cost"] },
  { key: "scan", label: "Scanning identified active services", matches: ["scanning active services", "resource scan"] },
  { key: "ai", label: "Running AI optimization evaluation", matches: ["analyzing costs with ai", "analyzing optimization"] },
  { key: "store", label: "Saving results and preparing report", matches: ["storing results", "preparing report"] },
];

export default function ProgressTracker({ updates, status }: ProgressTrackerProps) {
  const latest = updates[updates.length - 1];
  const latestText = (latest?.message ?? "").toLowerCase();
  const currentIndex = plannedSteps.findIndex((step) => step.matches.some((phrase) => latestText.includes(phrase)));
  const finished = status === "completed";

  return <section aria-live="polite" className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111713] p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">Analysis progress</h2><p className="mt-1 text-sm text-gray-400">{latest?.message ?? "Waiting for analysis updates…"}</p></div>
      {status === "in_progress" && <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200"><LoaderCircle size={13} className="animate-spin"/> Running</span>}
      {finished && <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">Complete</span>}
      {status === "failed" && <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs text-red-300">Failed</span>}
    </div>
    <ol className="mt-6 space-y-4">{plannedSteps.map((step, index) => {
      const complete = finished || (currentIndex >= 0 && index < currentIndex) || updates.some((update) => update.status === "completed" && (update.message ?? "").toLowerCase().includes("analysis complete") && index === plannedSteps.length - 1);
      const active = status === "in_progress" && (index === currentIndex || (currentIndex < 0 && index === 0));
      return <li key={step.key} className="flex gap-3 animate-[fadeIn_350ms_ease-out_both]" style={{ animationDelay: `${index * 90}ms` }}>
        <div className="flex flex-col items-center">{complete ? <CheckCircle2 className="h-5 w-5 text-emerald-300"/> : active ? <LoaderCircle className="h-5 w-5 animate-spin text-emerald-300"/> : status === "failed" && index === Math.max(currentIndex, 0) ? <XCircle className="h-5 w-5 text-red-300"/> : <Circle className="h-5 w-5 text-gray-600"/>}{index < plannedSteps.length - 1 && <span className={`mt-2 h-5 w-px ${complete ? "bg-emerald-400/40" : "bg-white/10"}`}/>}</div>
        <div className="min-w-0 pb-1"><p className={`text-sm ${complete ? "text-emerald-300" : active ? "font-medium text-white" : "text-gray-500"}`}>{step.label}</p>{active && <p className="mt-1 text-xs text-gray-500">This step is running now…</p>}</div>
      </li>;
    })}</ol>
    {updates.length > 0 && <div className="mt-5 border-t border-white/[0.07] pt-4"><p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Live event log</p><ul className="space-y-2">{updates.filter((item) => item.status !== "connected" && item.message).map((item, index) => <li key={`${item.timestamp ?? "event"}-${index}`} className="flex gap-2 text-xs text-gray-400"><span className={item.status === "completed" ? "text-emerald-300" : item.status === "failed" ? "text-red-300" : "text-emerald-300/60"}>•</span><span>{item.message}</span></li>)}</ul></div>}
    {status === "failed" && <div role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-200">{latest?.error ?? latest?.message ?? "The analysis failed. Please try again."}</div>}
    {finished && <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-sm text-emerald-200">Analysis completed successfully. Your report has been saved.</div>}
  </section>;
}
