"use client";

import React, { useState, useEffect } from "react";
import {
  Server,
  Database,
  Radio,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Terminal,
} from "lucide-react";
import { Header } from "@/components/Header";
import { api, API_BASE_URL, HealthResponse, ReadinessResponse } from "@/lib/api";

export default function HealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let ignore = false;
    const runCheck = () => {
      const start = performance.now();
      Promise.allSettled([api.getHealth(), api.getReadiness()])
        .then(([hRes, rRes]) => {
          if (ignore) return;
          const elapsed = Math.round(performance.now() - start);
          setLatencyMs(elapsed);
          setLastChecked(new Date().toLocaleTimeString());

          if (hRes.status === "fulfilled") {
            setHealth(hRes.value);
          } else {
            setHealth(null);
          }

          if (rRes.status === "fulfilled") {
            setReadiness(rRes.value);
          } else {
            setReadiness(null);
          }
        })
        .catch(() => {
          if (ignore) return;
          setHealth(null);
          setReadiness(null);
        });
    };

    runCheck();
    const interval = setInterval(runCheck, 10000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    const start = performance.now();
    try {
      const [hRes, rRes] = await Promise.allSettled([
        api.getHealth(),
        api.getReadiness(),
      ]);

      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setLastChecked(new Date().toLocaleTimeString());

      if (hRes.status === "fulfilled") {
        setHealth(hRes.value);
      } else {
        setHealth(null);
      }

      if (rRes.status === "fulfilled") {
        setReadiness(rRes.value);
      } else {
        setReadiness(null);
      }
    } catch {
      setHealth(null);
      setReadiness(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isApiOnline = health?.status === "ok";
  const isDbConnected = readiness?.database === "connected";
  const isRedisConnected = readiness?.redis === "connected";
  const isFullyReady = isApiOnline && isDbConnected && isRedisConnected;

  return (
    <div>
      <Header
        title="System Health & Infrastructure Readiness"
        description="Live operational telemetry and connection status for API, PostgreSQL, and Redis dependencies"
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Overall Status Banner */}
        <div
          className={`p-5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isFullyReady
              ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
              : isApiOnline
              ? "bg-amber-50/70 border-amber-200 text-amber-950"
              : "bg-rose-50/70 border-rose-200 text-rose-950"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isFullyReady
                  ? "bg-emerald-600 text-white"
                  : isApiOnline
                  ? "bg-amber-500 text-white"
                  : "bg-rose-600 text-white"
              }`}
            >
              {isFullyReady ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : isApiOnline ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                {isFullyReady
                  ? "All Core Services Operational"
                  : isApiOnline
                  ? "API Operational — Partial Dependency Degradation"
                  : "API Service Unavailable"}
              </h2>
              <p className="text-xs opacity-90 mt-0.5">
                {isFullyReady
                  ? "FastAPI server, PostgreSQL database, and Redis ingestion buffer are fully synchronized."
                  : isApiOnline
                  ? "FastAPI responded, but one or more backing dependencies (PostgreSQL or Redis) are offline."
                  : `Unable to establish connection to backend at ${API_BASE_URL}. Ensure the backend service is running.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono shrink-0">
            {latencyMs !== null && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 opacity-60" />
                {latencyMs} ms latency
              </span>
            )}
            {lastChecked && (
              <span className="opacity-75">Checked at {lastChecked}</span>
            )}
          </div>
        </div>

        {/* Dependency Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* FastAPI Server Card */}
          <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-700" />
                FastAPI Service
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium ${
                  isApiOnline
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {isApiOnline ? "Online (200 OK)" : "Unreachable"}
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Handles HTTP ingestion, rule management, and incident resolution endpoints.
            </p>

            <div className="p-3 rounded-md bg-slate-50 border border-slate-100 text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Target URL:</span>
                <span className="text-slate-800 truncate max-w-[180px]">{API_BASE_URL}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Endpoint:</span>
                <span className="text-slate-800">/health</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Service:</span>
                <span className="text-slate-800">{health?.service || "—"}</span>
              </div>
            </div>
          </div>

          {/* PostgreSQL Card */}
          <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-700" />
                PostgreSQL DB
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium ${
                  isDbConnected
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {isDbConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Persists sensor telemetry, configured alert rules, and audit logs.
            </p>

            <div className="p-3 rounded-md bg-slate-50 border border-slate-100 text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Connection:</span>
                <span className="text-slate-800">
                  {readiness?.database === "connected" ? "Active (PostgreSQL / SQLite)" : "Offline"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Probe Response:</span>
                <span className="text-slate-800">{readiness?.database || "Offline"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ORM / Driver:</span>
                <span className="text-slate-800">SQLAlchemy 2.x Async</span>
              </div>
            </div>
          </div>

          {/* Redis Card */}
          <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono flex items-center gap-2">
                <Radio className="w-4 h-4 text-slate-700" />
                Redis Queue & Dedup
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium ${
                  isRedisConnected
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {isRedisConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              10,000 readings/sec ingestion buffer and alert deduplication cache.
            </p>

            <div className="p-3 rounded-md bg-slate-50 border border-slate-100 text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Queue Buffer:</span>
                <span className="text-slate-800">terraforge:readings</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Probe Response:</span>
                <span className="text-slate-800">{readiness?.redis || "Offline"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dedup Key Prefix:</span>
                <span className="text-slate-800">terraforge:alert:dedup:*</span>
              </div>
            </div>
          </div>
        </div>

        {/* Troubleshooting & Stack Startup Commands */}
        <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-600" />
            Infrastructure Startup Guide
          </h3>
          <p className="text-xs text-slate-600">
            If any service reports as disconnected, use the commands below in your terminal to start the full stack:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-3.5 rounded-md bg-slate-900 text-slate-100 font-mono text-[11px] space-y-2">
              <span className="text-slate-400 text-[10px] block font-sans font-semibold uppercase">
                Option 1: Docker Compose (All Services)
              </span>
              <pre className="text-emerald-400 select-all">docker compose up --build</pre>
              <p className="text-slate-400 text-[10px] font-sans">
                Launches PostgreSQL 16, Redis 7, the FastAPI backend, and the background worker.
              </p>
            </div>

            <div className="p-3.5 rounded-md bg-slate-900 text-slate-100 font-mono text-[11px] space-y-2">
              <span className="text-slate-400 text-[10px] block font-sans font-semibold uppercase">
                Option 2: Native Python Backend
              </span>
              <pre className="text-emerald-400 select-all">python scripts/start_api.py</pre>
              <pre className="text-emerald-400 select-all">python scripts/start_worker.py</pre>
              <p className="text-slate-400 text-[10px] font-sans">
                Starts API and worker on the host machine connecting to local Redis & PostgreSQL.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
