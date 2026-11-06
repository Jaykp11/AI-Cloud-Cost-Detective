export interface User { id: string; email: string; created_at?: string; }
export interface AuthResponse { access_token: string; token_type: string; expires_in?: number; }
export interface SignupResponse { message: string; user: User; }
export interface SignupRequest { email: string; password: string; }
export interface LoginRequest { email: string; password: string; }
export interface AWSRegion { name: string; endpoint?: string; opt_in_status?: string; }
export type AnalysisStatus = "pending" | "in_progress" | "completed" | "failed";
export interface AnalysisIssue {
  title?: string; category?: string; resource?: string; resource_id?: string; resource_type?: string;
  severity?: "critical" | "high" | "medium" | "low" | "info"; description?: string; finding?: string;
  evidence?: unknown[]; recommendation?: string; estimated_monthly_savings?: number | string | null;
  remediation_commands?: string[]; verification_commands?: string[]; fix_commands?: string[];
  requires_approval?: boolean; [key: string]: unknown;
}
export interface AnalysisResult {
  summary?: string; issues?: AnalysisIssue[]; estimated_monthly_savings?: number | string | { amount?: number | null; currency?: string; confidence?: string };
  resources_scanned?: number; issues_found?: number; analysis?: AnalysisResult; recommendations?: string[];
  [key: string]: unknown;
}
export interface AnalysisRecord {
  id: string; analysis_id?: string; region: string; resources_scanned: number; issues_found: number;
  estimated_savings: string; analysis_result?: AnalysisResult | Record<string, unknown>; status: AnalysisStatus; created_at: string;
}
export interface AnalysisRequest { region: string; analysis_id: string; }
export interface ProgressUpdate {
  analysis_id?: string; status: AnalysisStatus | "connected" | string; message?: string; progress?: number;
  stage?: string; result?: AnalysisResult; error?: string; timestamp?: string;
}
