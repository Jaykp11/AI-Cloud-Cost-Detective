import {
useCallback,
useEffect,
useRef,
useState,
} from "react";

import {
Activity,
AlertCircle,
ArrowDownRight,
ArrowUpRight,
CheckCircle2,
Clock3,
Cloud,
LoaderCircle,
Play,
RefreshCw,
ShieldAlert,
Wallet,
Zap,
} from "lucide-react";

import {
analysisApi,
getApiErrorMessage,
regionApi,
} from "../lib/api";

import type {
AnalysisRecord,
AWSRegion,
ProgressUpdate,
} from "../lib/types";

import { useAuth } from "../context/AuthContext";
import ProgressTracker from "../components/ProgressTracker";

const TOKEN_KEY = "cloud_cost_access_token";

const FALLBACK_REGIONS: AWSRegion[] = [
{
name: "ap-south-1",
endpoint: "ec2.ap-south-1.amazonaws.com",
opt_in_status: "opt-in-not-required",
},
{
name: "us-east-1",
endpoint: "ec2.us-east-1.amazonaws.com",
opt_in_status: "opt-in-not-required",
},
{
name: "us-west-2",
endpoint: "ec2.us-west-2.amazonaws.com",
opt_in_status: "opt-in-not-required",
},
{
name: "eu-west-1",
endpoint: "ec2.eu-west-1.amazonaws.com",
opt_in_status: "opt-in-not-required",
},
{
name: "ap-southeast-1",
endpoint: "ec2.ap-southeast-1.amazonaws.com",
opt_in_status: "opt-in-not-required",
},
];

const REGION_LABELS: Record<string, string> = {
"ap-south-1": "Asia Pacific · Mumbai",
"us-east-1": "US East · N. Virginia",
"us-west-2": "US West · Oregon",
"eu-west-1": "Europe · Ireland",
"ap-southeast-1": "Asia Pacific · Singapore",
};

type AnalysisProgressStatus =
| "pending"
| "in_progress"
| "completed"
| "failed";

function formatCurrency(value: unknown): string {
if (typeof value === "number" && Number.isFinite(value)) {
return new Intl.NumberFormat("en-US", {
style: "currency",
currency: "USD",
maximumFractionDigits: 2,
}).format(value);
}

if (typeof value === "string" && value.trim()) {
const trimmed = value.trim();


if (/^\$?-?\d+(\.\d+)?$/.test(trimmed)) {
  const numericValue = Number(trimmed.replace("$", ""));

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(numericValue);
}

return trimmed;


}

return "—";
}

function formatDate(value?: string): string {
if (!value) return "—";

const date = new Date(value);

if (Number.isNaN(date.getTime())) return "—";

return new Intl.DateTimeFormat(undefined, {
dateStyle: "medium",
timeStyle: "short",
}).format(date);
}

function getRecordId(record: AnalysisRecord): string {
return record.analysis_id || record.id;
}

function getStatusClasses(status: string): string {
switch (status) {
case "completed":
return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";

case "failed":
  return "border-red-400/20 bg-red-400/10 text-red-300";

case "in_progress":
  return "border-amber-400/20 bg-amber-400/10 text-amber-300";

default:
  return "border-white/10 bg-white/5 text-gray-400";


}
}

export default function Dashboard() {
const { user } = useAuth();

// AWS regions
const [regions, setRegions] =
useState<AWSRegion[]>(FALLBACK_REGIONS);

const [selectedRegion, setSelectedRegion] =
useState("ap-south-1");

const [regionsLoading, setRegionsLoading] = useState(true);
const [regionsNotice, setRegionsNotice] = useState("");

// Analysis history
const [history, setHistory] = useState<AnalysisRecord[]>([]);
const [historyLoading, setHistoryLoading] = useState(true);
const [historyError, setHistoryError] = useState("");

// Analysis execution
const [analyzing, setAnalyzing] = useState(false);
const [analysisError, setAnalysisError] = useState("");

const [progressUpdates, setProgressUpdates] =
useState<ProgressUpdate[]>([]);

const [progressStatus, setProgressStatus] =
useState<AnalysisProgressStatus>("pending");

const [latestAnalysis, setLatestAnalysis] =
useState<AnalysisRecord | null>(null);

// WebSocket management
const socketRef = useRef<WebSocket | null>(null);
const activeAnalysisIdRef = useRef<string | null>(null);

const closeProgressSocket = useCallback(() => {
const socket = socketRef.current;


if (socket) {
  socket.onclose = null;
  socket.onmessage = null;
  socket.onerror = null;
  socket.close();

  socketRef.current = null;
}


}, []);

// Load analysis history
const loadHistory = useCallback(async () => {
setHistoryLoading(true);
setHistoryError("");


try {
  const records = await analysisApi.getHistory();

  setHistory(records);

  return records;
} catch (error) {
  setHistoryError(getApiErrorMessage(error));

  return [];
} finally {
  setHistoryLoading(false);
}


}, []);

// Load available AWS regions and history
useEffect(() => {
let active = true;


async function loadRegions() {
  setRegionsLoading(true);

  try {
    const availableRegions = await regionApi.getRegions();

    if (!active) return;

    if (availableRegions.length > 0) {
      setRegions(availableRegions);
      setRegionsNotice("");

      // Keep the current region if available; otherwise select
      // the first region returned by AWS.
      setSelectedRegion((current) => {
        const exists = availableRegions.some(
          (region) => region.name === current,
        );

        return exists
          ? current
          : availableRegions[0].name;
      });
    } else {
      setRegions(FALLBACK_REGIONS);

      setRegionsNotice(
        "AWS returned no enabled regions. Common regions are shown temporarily.",
      );
    }
  } catch (error) {
    if (!active) return;

    setRegions(FALLBACK_REGIONS);

    setRegionsNotice(
      `Live AWS region discovery is unavailable. Common regions are shown temporarily. ${getApiErrorMessage(error)}`,
    );
  } finally {
    if (active) {
      setRegionsLoading(false);
    }
  }
}

void loadRegions();
void loadHistory();

return () => {
  active = false;
};

}, [loadHistory]);

// Close WebSocket when leaving the dashboard
useEffect(() => {
return () => {
closeProgressSocket();
};
}, [closeProgressSocket]);

// Connect to live analysis progress updates
const connectProgressSocket = useCallback(
(analysisId: string) => {
closeProgressSocket();


  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) return;

  // Match the REST API fallback so WebSocket progress still works
  // when VITE_API_BASE_URL is not explicitly set.
  const baseUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
    "http://127.0.0.1:8000";

  try {
    const websocketUrl = new URL(baseUrl);

    websocketUrl.protocol =
      websocketUrl.protocol === "https:"
        ? "wss:"
        : "ws:";

    websocketUrl.pathname =
      `${websocketUrl.pathname.replace(/\/$/, "")}/ws/progress/${analysisId}`;

    websocketUrl.searchParams.set("token", token);

    const socket = new WebSocket(websocketUrl.toString());

    socketRef.current = socket;

    // Temporary diagnostics to verify the application WebSocket.
    // Never print the JWT token to the console.
    socket.onopen = () => {
      console.info(
        "[Progress WS] Connected:",
        websocketUrl.toString().replace(/([?&]token=)[^&]*/, "$1[REDACTED]"),
      );
    };

    socket.onerror = (event) => {
      console.error("[Progress WS] Connection error:", event);
    };

    socket.onclose = (event) => {
      console.info("[Progress WS] Closed:", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
    };

    socket.onmessage = (event) => {
      try {
        const update = JSON.parse(
          event.data,
        ) as ProgressUpdate;

        if (
          update.analysis_id &&
          update.analysis_id !== activeAnalysisIdRef.current
        ) {
          return;
        }

        // Ignore the connection acknowledgement in the visible
        // progress timeline; retain actual progress messages.
        if (update.status === "connected") {
          return;
        }

        setProgressUpdates((current) => [
          ...current,
          update,
        ]);

        if (
          update.status === "pending" ||
          update.status === "in_progress" ||
          update.status === "completed" ||
          update.status === "failed"
        ) {
          setProgressStatus(update.status);
        }

        if (update.status === "failed") {
          setAnalysisError(
            update.message ||
              update.error ||
              "The analysis failed.",
          );
        }
      } catch {
        // Ignore malformed WebSocket messages.
      }
    };

  } catch (error) {
    // REST API responses remain authoritative if WebSocket
    // connectivity fails, but log the reason for debugging.
    console.error("[Progress WS] Could not create connection:", error);
  }
},
[closeProgressSocket],


);

// Start an infrastructure analysis
const runAnalysis = async () => {
if (analyzing || !selectedRegion) return;


const analysisId = crypto.randomUUID();

activeAnalysisIdRef.current = analysisId;

setAnalyzing(true);
setAnalysisError("");
setLatestAnalysis(null);

setProgressStatus("in_progress");

setProgressUpdates([
  {
    analysis_id: analysisId,
    status: "in_progress",
    message: "Initializing analysis...",
    stage: "Initializing analysis",
  },
]);

connectProgressSocket(analysisId);

try {
  const result = await analysisApi.analyze({
    region: selectedRegion,
    analysis_id: analysisId,
  });

  setLatestAnalysis(result);

  const finalStatus: AnalysisProgressStatus =
    result.status === "failed"
      ? "failed"
      : "completed";

  setProgressStatus(finalStatus);

  setProgressUpdates((current) => {
    // Avoid adding a duplicate final update if the WebSocket
    // already delivered it.
    const alreadyFinalized = current.some(
      (update) =>
        update.analysis_id === analysisId &&
        update.status === finalStatus &&
        update.message === "Analysis completed successfully.",
    );

    if (alreadyFinalized) return current;

    return [
      ...current,
      {
        analysis_id: analysisId,
        status: finalStatus,
        message:
          finalStatus === "completed"
            ? "Analysis completed successfully."
            : "The analysis did not complete successfully.",
        stage: "Preparing report",
      },
    ];
  });

  if (finalStatus === "failed") {
    setAnalysisError(
      "The backend reported that the analysis failed.",
    );
  }

  await loadHistory();
} catch (error) {
  const message = getApiErrorMessage(error);

  setAnalysisError(message);
  setProgressStatus("failed");

  setProgressUpdates((current) => [
    ...current,
    {
      analysis_id: analysisId,
      status: "failed",
      message: "The analysis could not be completed.",
      error: message,
    },
  ]);

  await loadHistory();
} finally {
  closeProgressSocket();
  setAnalyzing(false);
}


};

// Summary metrics derived from completed analyses
const recentAnalyses = history.slice(0, 5);

const completedAnalyses = history.filter(
(record) => record.status === "completed",
);

const totalIssues = completedAnalyses.reduce(
(sum, record) => sum + (record.issues_found || 0),
0,
);

const totalResources = completedAnalyses.reduce(
(sum, record) => sum + (record.resources_scanned || 0),
0,
);

const completedSavings = completedAnalyses
.map((record) => {
const value = Number(
String(record.estimated_savings ?? "")
.replace(/[$,]/g, ""),
);


  return Number.isFinite(value) ? value : 0;
})
.reduce((sum, value) => sum + value, 0);


const summaryCards = [
{
label: "Analyses completed",
value: String(completedAnalyses.length),
description: "Successfully completed scans",
icon: Activity,
iconClass: "text-sky-300",
iconBg: "bg-sky-400/10",
},
{
label: "Resources scanned",
value: totalResources.toLocaleString(),
description: "Across completed analyses",
icon: Cloud,
iconClass: "text-violet-300",
iconBg: "bg-violet-400/10",
},
{
label: "Issues detected",
value: totalIssues.toLocaleString(),
description: "Across completed analyses",
icon: ShieldAlert,
iconClass: "text-amber-300",
iconBg: "bg-amber-400/10",
},
{
label: "Estimated savings",
value:
completedAnalyses.length > 0
? formatCurrency(completedSavings)
: "—",
description: "Reported by completed analyses",
icon: Wallet,
iconClass: "text-emerald-300",
iconBg: "bg-emerald-400/10",
},
];

return ( <div className="mx-auto w-full max-w-7xl space-y-8 pb-12">
{/* Page heading */} <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"> <div> <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300"> <span className="h-2 w-2 rounded-full bg-emerald-400" />
Cloud intelligence </p>


      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Cloud Cost Dashboard
      </h1>

      <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
        Discover infrastructure inefficiencies, understand your
        cloud spend, and identify opportunities to optimize AWS
        costs.
      </p>
    </div>

    <button
      type="button"
      onClick={() => void loadHistory()}
      disabled={historyLoading}
      className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
    >
      <RefreshCw
        size={16}
        className={historyLoading ? "animate-spin" : ""}
      />
      Refresh data
    </button>
  </section>

  {/* Analysis launcher */}
  <section className="relative overflow-hidden rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-[#13251d] via-[#101a15] to-[#101412] p-6 sm:p-8">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-emerald-400/[0.07] blur-3xl"
    />

    <div className="relative grid gap-8 lg:grid-cols-[1fr_340px] lg:items-center">
      <div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-xs font-medium text-emerald-200">
          <Zap size={14} />
          AI-powered infrastructure analysis
        </div>

        <h2 className="max-w-xl text-2xl font-semibold leading-tight text-white sm:text-3xl">
          Find hidden opportunities in your cloud infrastructure.
        </h2>

        <p className="mt-3 max-w-xl text-sm leading-6 text-gray-400">
          Select a region to scan available cost and resource data,
          then review the findings and recommendations generated
          by your analysis pipeline.
        </p>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-400">
          <span className="flex items-center gap-2">
            <CheckCircle2
              size={14}
              className="text-emerald-300"
            />
            Resource discovery
          </span>

          <span className="flex items-center gap-2">
            <CheckCircle2
              size={14}
              className="text-emerald-300"
            />
            AI recommendations
          </span>

          <span className="flex items-center gap-2">
            <CheckCircle2
              size={14}
              className="text-emerald-300"
            />
            Saved reports
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
        <label
          htmlFor="aws-region"
          className="mb-2 block text-sm font-medium text-gray-200"
        >
          AWS Region
        </label>

        <select
          id="aws-region"
          value={selectedRegion}
          onChange={(event) =>
            setSelectedRegion(event.target.value)
          }
          disabled={analyzing || regionsLoading}
          className="w-full rounded-xl border border-white/10 bg-[#111713] px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/10 disabled:opacity-60"
        >
          {regions.map((region) => (
            <option key={region.name} value={region.name}>
              {REGION_LABELS[region.name]
                ? `${REGION_LABELS[region.name]} (${region.name})`
                : region.name}
            </option>
          ))}
        </select>

        {regionsNotice && (
          <p className="mt-2 text-xs leading-5 text-amber-300/90">
            {regionsNotice}
          </p>
        )}

        <button
          type="button"
          onClick={() => void runAnalysis()}
          disabled={
            analyzing ||
            regionsLoading ||
            !selectedRegion
          }
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-[#0b100e] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {analyzing ? (
            <>
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
              Analysis running...
            </>
          ) : (
            <>
              <Play size={17} fill="currentColor" />
              Run Analysis
            </>
          )}
        </button>

        <p className="mt-3 text-center text-xs text-gray-500">
          {regionsLoading
            ? "Loading available regions..."
            : "Uses your configured AWS credentials"}
        </p>
      </div>
    </div>
  </section>

  {/* Analysis error */}
  {analysisError && (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4"
    >
      <AlertCircle
        size={20}
        className="mt-0.5 shrink-0 text-red-300"
      />

      <div>
        <p className="text-sm font-medium text-red-200">
          Analysis could not be completed
        </p>

        <p className="mt-1 break-words text-sm leading-6 text-red-200/70">
          {analysisError}
        </p>
      </div>
    </div>
  )}

  {/* Progress tracker */}
  {(analyzing || progressUpdates.length > 0) && (
    <ProgressTracker
      updates={progressUpdates}
      status={progressStatus}
    />
  )}

  {/* Summary cards */}
  <section>
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">
        Analysis overview
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        Aggregated from your saved completed analyses
      </p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map((card) => {
        const Icon = card.icon;

        return (
          <article
            key={card.label}
            className="rounded-2xl border border-white/[0.08] bg-[#111713] p-5 transition hover:border-white/[0.14]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gray-400">
                  {card.label}
                </p>

                <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  {card.value}
                </p>
              </div>

              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg} ${card.iconClass}`}
              >
                <Icon size={19} />
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              {card.description}
            </p>
          </article>
        );
      })}
    </div>
  </section>

  {/* Latest analysis result */}
  {latestAnalysis && (
    <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-300">
            <CheckCircle2 size={18} />

            <h2 className="font-semibold">
              Latest analysis received
            </h2>
          </div>

          <p className="mt-2 text-sm text-gray-400">
            Region: {latestAnalysis.region || selectedRegion}
          </p>

          <p className="mt-1 text-sm text-gray-400">
            {latestAnalysis.issues_found ?? 0} issues detected
            {" · "}
            {latestAnalysis.resources_scanned ?? 0} resources
            scanned
          </p>
        </div>

        <a
          href={`/report/${getRecordId(latestAnalysis)}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/20 px-4 py-2.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-300/10"
        >
          View report
          <ArrowUpRight size={16} />
        </a>
      </div>
    </section>
  )}

  {/* Recent analysis history */}
  <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111713]">
    <div className="flex flex-col gap-3 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <h2 className="font-semibold text-white">
          Recent analyses
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Your latest saved infrastructure scans
        </p>
      </div>

      <a
        href="/history"
        className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
      >
        View all history
        <ArrowDownRight size={16} />
      </a>
    </div>

    {historyLoading ? (
      <div className="flex items-center justify-center gap-3 p-10 text-sm text-gray-400">
        <LoaderCircle
          size={18}
          className="animate-spin"
        />
        Loading analysis history...
      </div>
    ) : historyError ? (
      <div className="p-6">
        <div className="flex items-start gap-3 text-sm text-amber-200">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <div>
            <p>Could not load analysis history.</p>

            <p className="mt-1 text-amber-200/70">
              {historyError}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadHistory()}
          className="mt-4 text-sm font-medium text-emerald-300 hover:text-emerald-200"
        >
          Try again
        </button>
      </div>
    ) : recentAnalyses.length === 0 ? (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-gray-400">
          <Clock3 size={21} />
        </div>

        <h3 className="mt-4 font-medium text-white">
          No analyses yet
        </h3>

        <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
          Your completed scans will appear here. Select an AWS
          region above to get started.
        </p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-white/[0.015] text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-6 py-4 font-medium">
                Region
              </th>

              <th className="px-6 py-4 font-medium">
                Date
              </th>

              <th className="px-6 py-4 font-medium">
                Issues
              </th>

              <th className="px-6 py-4 font-medium">
                Savings
              </th>

              <th className="px-6 py-4 font-medium">
                Status
              </th>

              <th className="px-6 py-4 font-medium">
                Report
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/[0.05]">
            {recentAnalyses.map((record) => (
              <tr
                key={record.id}
                className="transition hover:bg-white/[0.025]"
              >
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-200">
                    {record.region}
                  </div>
                </td>

                <td className="whitespace-nowrap px-6 py-4 text-gray-400">
                  {formatDate(record.created_at)}
                </td>

                <td className="px-6 py-4">
                  <span className="text-gray-200">
                    {record.issues_found ?? 0}
                  </span>
                </td>

                <td className="px-6 py-4 font-medium text-emerald-300">
                  {formatCurrency(record.estimated_savings)}
                </td>

                <td className="px-6 py-4">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(record.status)}`}
                  >
                    {record.status.replace("_", " ")}
                  </span>
                </td>

                <td className="px-6 py-4">
                  <a
                    href={`/report/${getRecordId(record)}`}
                    aria-label={`View report for ${record.region}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300 hover:text-emerald-200"
                  >
                    Open
                    <ArrowUpRight size={14} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {history.length > 0 && (
      <div className="flex items-center gap-2 border-t border-white/[0.06] px-6 py-3 text-xs text-gray-500">
        <Activity size={13} />
        Showing {recentAnalyses.length} of {history.length} analyses
      </div>
    )}
  </section>

  {/* Footer */}
  <footer className="flex flex-col justify-between gap-2 border-t border-white/[0.06] pt-5 text-xs text-gray-600 sm:flex-row">
    <span>AI Cloud Cost Detective</span>

    <span>
      {user?.email
        ? `Signed in as ${user.email}`
        : "Authenticated session"}
    </span>
  </footer>
</div>


);
}
