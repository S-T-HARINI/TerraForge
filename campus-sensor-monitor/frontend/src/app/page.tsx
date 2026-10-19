"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sliders,
  Thermometer,
  Droplets,
  Wind,
  Volume2,
  Zap,
  ArrowRight,
  Info,
} from "lucide-react";
import { Header } from "@/components/Header";
import { api, Alert, AlertRule, ReadinessResponse } from "@/lib/api";
import { formatDateTime, getReadingUnit } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const SENSOR_CATEGORIES = [
  {
    type: "temperature",
    name: "Temperature",
    icon: Thermometer,
    unit: "°C",
  },
  {
    type: "humidity",
    name: "Relative Humidity",
    icon: Droplets,
    unit: "%",
  },
  {
    type: "co2",
    name: "Carbon Dioxide",
    icon: Wind,
    unit: " ppm",
  },
  {
    type: "noise",
    name: "Acoustic Noise",
    icon: Volume2,
    unit: " dB",
  },
  {
    type: "power",
    name: "Power Consumption",
    icon: Zap,
    unit: " W",
  },
];

export default function OverviewPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    const load = () => {
      Promise.allSettled([
        api.listAlerts(),
        api.listRules(),
        api.getReadiness(),
      ])
        .then(([alertsRes, rulesRes, readyRes]) => {
          if (ignore) return;
          if (alertsRes.status === "fulfilled") {
            setAlerts(alertsRes.value);
          }
          if (rulesRes.status === "fulfilled") {
            setRules(rulesRes.value);
          }
          if (readyRes.status === "fulfilled") {
            setReadiness(readyRes.value);
          }
          setIsLoading(false);
          setIsRefreshing(false);
        })
        .catch((err: unknown) => {
          if (ignore) return;
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg || "Failed to load overview data from API.");
          setIsLoading(false);
          setIsRefreshing(false);
        });
    };

    load();
    const interval = setInterval(load, 15000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [alertsRes, rulesRes, readyRes] = await Promise.allSettled([
        api.listAlerts(),
        api.listRules(),
        api.getReadiness(),
      ]);

      if (alertsRes.status === "fulfilled") {
        setAlerts(alertsRes.value);
      }
      if (rulesRes.status === "fulfilled") {
        setRules(rulesRes.value);
      }
      if (readyRes.status === "fulfilled") {
        setReadiness(readyRes.value);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Failed to load overview data from API.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const openAlerts = alerts.filter((a) => a.status === "open");
  const ackAlerts = alerts.filter((a) => a.status === "acknowledged");

  // Chart data built from actual alerts timeline if available
  const chartData = alerts.slice(0, 15).reverse().map((a) => ({
    time: new Date(a.triggered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    value: a.observed_value,
    sensor: a.sensor_id,
    type: a.reading_type,
  }));

  return (
    <div>
      <Header
        title="Campus Sensor Monitoring"
        description="Real-time IoT telemetry, active alert rules, and incident lifecycle overview"
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        actions={
          <Link
            href="/simulator"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Launch Simulator</span>
          </Link>
        }
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* System Notification / Status Alert */}
        {error && (
          <div className="p-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={handleManualRefresh}
              className="text-xs font-medium underline hover:text-rose-950"
            >
              Retry
            </button>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Open Alerts */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">
                Open Alerts
              </span>
              <span className="w-6 h-6 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {isLoading ? "—" : openAlerts.length}
              </span>
              <span className="text-xs text-rose-600 font-medium">
                {openAlerts.length > 0 ? "Requires action" : "Nominal"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Active conditions breaching threshold rules
            </p>
          </div>

          {/* Acknowledged / In Progress */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">
                Acknowledged
              </span>
              <span className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {isLoading ? "—" : ackAlerts.length}
              </span>
              <span className="text-xs text-amber-600 font-medium">Under review</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Assigned to campus facility operators
            </p>
          </div>

          {/* Active Rules */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">
                Active Rules
              </span>
              <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
                <Sliders className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {isLoading ? "—" : rules.filter((r) => r.enabled).length}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                / {rules.length} total
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Configured threshold and sliding window rules
            </p>
          </div>

          {/* System Readiness */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">
                Pipeline Health
              </span>
              <span
                className={`w-6 h-6 rounded-md flex items-center justify-center ${
                  readiness?.status === "ready"
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-sm font-semibold capitalize tracking-tight text-slate-900">
                {readiness?.status || (isLoading ? "Connecting..." : "Offline")}
              </span>
              <span
                className={`text-[11px] font-mono ${
                  readiness?.database === "connected" && readiness?.redis === "connected"
                    ? "text-emerald-600"
                    : "text-slate-500"
                }`}
              >
                {readiness ? "DB & Redis Active" : "Service Disconnected"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Redis ingestion buffer & PostgreSQL persistence
            </p>
          </div>
        </div>

        {/* Sensor Categories Matrix */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider font-mono">
              Monitored Telemetry Domains
            </h2>
            <span className="text-[11px] text-slate-500">5 active IoT parameters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {SENSOR_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const matchingRules = rules.filter((r) => r.reading_type === cat.type && r.enabled);
              const matchingAlerts = openAlerts.filter((a) => a.reading_type === cat.type);

              return (
                <div
                  key={cat.type}
                  className="p-3.5 rounded-lg border border-slate-200 bg-white flex flex-col justify-between hover:border-slate-300 transition-colors shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-800 flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                      {matchingAlerts.length > 0 ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          {matchingAlerts.length} alert{matchingAlerts.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200">
                          Nominal
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-xs text-slate-900 block truncate">
                      {cat.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                      {matchingAlerts.length > 0
                        ? `Latest incident: ${matchingAlerts[0].observed_value}${cat.unit}`
                        : "Status: No active alerts"}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Rules: {matchingRules.length}</span>
                    <span
                      className="font-mono text-slate-400 truncate max-w-[120px]"
                      title={
                        matchingRules.length > 0
                          ? matchingRules
                              .map((r) => `${r.operator} ${r.threshold}${cat.unit}`)
                              .join(", ")
                          : "No configured rules"
                      }
                    >
                      {matchingRules.length > 0
                        ? matchingRules
                            .map((r) => `${r.operator} ${r.threshold}${cat.unit}`)
                            .slice(0, 2)
                            .join(", ")
                        : "No rules"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Telemetry Chart & Recent Alerts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Time Series Area Chart */}
          <div className="lg:col-span-2 p-5 rounded-lg border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono">
                  Observed Incident Telemetry Values
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Values recorded during triggered alert events over time
                </p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                {chartData.length} Recent Breaches
              </span>
            </div>

            {chartData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f172a" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderColor: "#e2e8f0",
                        fontSize: "12px",
                        borderRadius: "6px",
                      }}
                      formatter={(val: unknown, _name: unknown, item: { payload?: { type?: string; sensor?: string } }) => [
                        `${String(val)}${getReadingUnit(item?.payload?.type || "")} (${item?.payload?.sensor || ""})`,
                        "Observed Value",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#0f172a"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#valueGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <p className="text-xs font-semibold text-slate-800">No Alert Breaches Recorded</p>
                <p className="text-[11px] text-slate-500 max-w-sm mt-1">
                  All sensor readings are operating within nominal thresholds. You can launch the
                  Sensor Simulator to inject test anomalies.
                </p>
                <Link
                  href="/simulator"
                  className="mt-3 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-900 text-white hover:bg-slate-800"
                >
                  Generate Test Anomalies
                </Link>
              </div>
            )}
          </div>

          {/* Recent Alerts Feed */}
          <div className="p-5 rounded-lg border border-slate-200 bg-white flex flex-col shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono">
                  Recent Incidents
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Most recent alerts generated</p>
              </div>
              <Link
                href="/alerts"
                className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-64">
              {alerts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <span className="text-xs text-slate-500">No alerts in system.</span>
                </div>
              ) : (
                alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-md border border-slate-100 bg-slate-50 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900 truncate max-w-[160px]">
                        {alert.sensor_id}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded capitalize ${
                          alert.status === "open"
                            ? "bg-rose-100 text-rose-700 font-medium"
                            : alert.status === "acknowledged"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-1">{alert.message}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>
                        Value: {alert.observed_value}
                        {getReadingUnit(alert.reading_type)}
                      </span>
                      <span>{formatDateTime(alert.triggered_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Architecture & Pipeline Notice */}
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-100/60 flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-medium text-slate-900">
              High-Throughput Streaming Architecture
            </p>
            <p>
              TerraForge ingests telemetry at bursts up to 10,000 readings/sec into a Redis-backed
              buffer (`terraforge:readings`). Background worker pools asynchronously evaluate single-reading
              and sliding time-window alert rules, deduplicate incidents, and persist records into PostgreSQL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
