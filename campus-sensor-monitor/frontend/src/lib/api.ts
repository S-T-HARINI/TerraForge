/**
 * TerraForge Centralized API Client Layer
 * Connected to FastAPI Backend (Default: http://localhost:8000)
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export interface HealthResponse {
  status: string;
  service: string;
}

export interface ReadinessResponse {
  status: string;
  database: string;
  redis: string;
}

export interface SensorReadingPayload {
  sensorId: string;
  type: string;
  value: number;
  timestamp: string;
}

export interface BatchReadingResponse {
  accepted: number;
  message: string;
}

export type RuleType = "threshold" | "time_window";
export type RuleOperator = ">" | ">=" | "<" | "<=" | "==" | "!=";

export interface AlertRule {
  id: string;
  name: string;
  description?: string | null;
  sensor_id?: string | null;
  reading_type: string;
  rule_type: RuleType;
  operator: RuleOperator;
  threshold: number;
  window_seconds?: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertRuleCreate {
  name: string;
  description?: string | null;
  sensor_id?: string | null;
  reading_type: string;
  rule_type: RuleType;
  operator: RuleOperator;
  threshold: number;
  window_seconds?: number | null;
  enabled?: boolean;
}

export interface AlertRuleUpdate {
  name?: string;
  description?: string | null;
  sensor_id?: string | null;
  reading_type?: string;
  rule_type?: RuleType;
  operator?: RuleOperator;
  threshold?: number;
  window_seconds?: number | null;
  enabled?: boolean;
}

export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface Alert {
  id: string;
  rule_id: string;
  sensor_id: string;
  reading_type: string;
  message: string;
  observed_value: number;
  status: AlertStatus;
  triggered_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  acknowledged_by?: string | null;
  resolved_by?: string | null;
  details?: Record<string, unknown> | null;
}

export interface AlertAcknowledgeRequest {
  acknowledged_by: string;
}

export interface AlertResolveRequest {
  resolved_by: string;
  resolution_note?: string | null;
}

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = { detail: response.statusText };
      }
      const dataObj = errorData as { detail?: unknown } | null;
      let message = `HTTP error ${response.status}: ${response.statusText}`;
      if (typeof dataObj?.detail === "string") {
        message = dataObj.detail;
      } else if (Array.isArray(dataObj?.detail)) {
        message = dataObj.detail
          .map((e: unknown) =>
            typeof e === "object" && e !== null && "msg" in e
              ? String((e as { msg: unknown }).msg)
              : JSON.stringify(e)
          )
          .join("; ");
      }

      throw new ApiError(response.status, message, errorData);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new ApiError(
      0,
      `Network error connecting to TerraForge API at ${API_BASE_URL}: ${errorMsg}`
    );
  }
}

export const api = {
  // Health
  getHealth: () => request<HealthResponse>("/health"),
  getReadiness: () => request<ReadinessResponse>("/health/ready"),

  // Readings Ingestion
  ingestReading: (data: SensorReadingPayload) =>
    request<BatchReadingResponse>("/api/v1/readings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  ingestBatch: (readings: SensorReadingPayload[]) =>
    request<BatchReadingResponse>("/api/v1/readings/batch", {
      method: "POST",
      body: JSON.stringify({ readings }),
    }),

  // Alert Rules
  listRules: (enabledOnly = false, limit = 100, offset = 0) => {
    const params = new URLSearchParams();
    if (enabledOnly) params.append("enabled_only", "true");
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    return request<AlertRule[]>(`/api/v1/rules?${params.toString()}`);
  },
  getRule: (id: string) => request<AlertRule>(`/api/v1/rules/${id}`),
  createRule: (data: AlertRuleCreate) =>
    request<AlertRule>("/api/v1/rules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRule: (id: string, data: AlertRuleUpdate) =>
    request<AlertRule>(`/api/v1/rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  enableRule: (id: string) =>
    request<AlertRule>(`/api/v1/rules/${id}/enable`, {
      method: "PATCH",
    }),
  disableRule: (id: string) =>
    request<AlertRule>(`/api/v1/rules/${id}/disable`, {
      method: "PATCH",
    }),

  // Alerts
  listAlerts: (status?: string, sensorId?: string, limit = 100, offset = 0) => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (sensorId) params.append("sensor_id", sensorId);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    return request<Alert[]>(`/api/v1/alerts?${params.toString()}`);
  },
  getAlert: (id: string) => request<Alert>(`/api/v1/alerts/${id}`),
  acknowledgeAlert: (id: string, acknowledgedBy: string) =>
    request<Alert>(`/api/v1/alerts/${id}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({ acknowledged_by: acknowledgedBy }),
    }),
  resolveAlert: (
    id: string,
    resolvedBy: string,
    resolutionNote?: string | null
  ) =>
    request<Alert>(`/api/v1/alerts/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({
        resolved_by: resolvedBy,
        resolution_note: resolutionNote || null,
      }),
    }),
};
