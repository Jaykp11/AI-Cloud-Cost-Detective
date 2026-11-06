import axios from "axios";
import type {
  AnalysisRecord,
  AnalysisRequest,
  AuthResponse,
  AWSRegion,
  LoginRequest,
  SignupRequest,
  SignupResponse,
  User,
} from "./types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "http://127.0.0.1:8000";
export const TOKEN_KEY = "cloud_cost_access_token";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 180_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = String(error.config?.url ?? "");
    const isAuthRequest = url.includes("/api/auth/login") || url.includes("/api/auth/signup");
    if (status === 401 && !isAuthRequest) {
      localStorage.removeItem(TOKEN_KEY);
      if (!["/login", "/signup"].includes(window.location.pathname)) window.location.assign("/login");
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  async signup(data: SignupRequest): Promise<SignupResponse> {
    return (await api.post<SignupResponse>("/api/auth/signup", data)).data;
  },
  async login(data: LoginRequest): Promise<AuthResponse> {
    const form = new URLSearchParams();
    form.set("username", data.email);
    form.set("password", data.password);
    return (await api.post<AuthResponse>("/api/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })).data;
  },
  async me(): Promise<User> {
    return (await api.get<User>("/api/auth/me")).data;
  },
};

export const regionApi = {
  async getRegions(): Promise<AWSRegion[]> {
    const data = (await api.get<{ regions: AWSRegion[] }>("/api/regions")).data;
    if (!Array.isArray(data.regions)) throw new Error("The backend returned an unexpected regions response.");
    return data.regions;
  },
};

export const analysisApi = {
  async analyze(data: AnalysisRequest): Promise<AnalysisRecord> {
    const result = (await api.post<Record<string, unknown>>("/api/analyze", data)).data;
    const nestedAnalysis = result.analysis && typeof result.analysis === "object"
      ? result.analysis as Record<string, unknown>
      : {};
    const issues = Array.isArray(nestedAnalysis.issues) ? nestedAnalysis.issues : [];
    const resources = Array.isArray(result.resources) ? result.resources : [];
    const savingsObject = nestedAnalysis.estimated_monthly_savings;
    const savingsAmount = savingsObject && typeof savingsObject === "object"
      ? (savingsObject as { amount?: unknown }).amount
      : savingsObject;
    return {
      ...result,
      id: String(result.analysis_id ?? data.analysis_id),
      analysis_id: String(result.analysis_id ?? data.analysis_id),
      region: String(result.region ?? data.region),
      resources_scanned: Number(result.resources_scanned ?? resources.length),
      issues_found: Number(result.issues_found ?? issues.length),
      estimated_savings: savingsAmount === null || savingsAmount === undefined ? "Not estimated" : String(savingsAmount),
      status: "completed",
      created_at: new Date().toISOString(),
      analysis_result: result,
    } as AnalysisRecord;
  },
  async getHistory(limit = 50, offset = 0): Promise<AnalysisRecord[]> {
    const data = (await api.get<{ analyses: AnalysisRecord[] }>("/api/history", { params: { limit, offset } })).data;
    if (!Array.isArray(data.analyses)) throw new Error("The backend returned an unexpected history response.");
    return data.analyses;
  },
  async getHistoryItem(id: string): Promise<AnalysisRecord> {
    return (await api.get<AnalysisRecord>(`/api/history/${encodeURIComponent(id)}`)).data;
  },
};

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item: { msg?: string }) => item.msg ?? "Invalid input").join(", ");
    if (!error.response) return "Cannot connect to the backend. Check that FastAPI is running and VITE_API_BASE_URL is correct.";
    if (error.response.status === 401) return "Your session is invalid or expired. Please log in again.";
    if (error.response.status === 403) return "You do not have permission to perform this action.";
    if (error.response.status >= 500) return "The server encountered an error. Please try again later.";
  }
  return error instanceof Error ? error.message : fallback;
}

export function getWebSocketUrl(analysisId: string, token: string): string {
  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/ws/progress/${encodeURIComponent(analysisId)}`;
  url.searchParams.set("token", token);
  return url.toString();
}
