"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  Search,
  Info,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Radio,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Layers,
} from "lucide-react";
import { Header } from "@/components/Header";
import { api, AlertRule, Alert } from "@/lib/api";
import { getReadingUnit } from "@/lib/utils";

// Explicit Demo-Only Sample Sensors (Used strictly when Demo Mode is explicitly toggled ON)
const DEMO_CAMPUS_SENSORS = [
  { id: "demo-lib-01", type: "temperature", location: "Library - 1st Floor East", nominal: 22.4 },
  { id: "demo-lib-02", type: "humidity", location: "Library - Rare Books Archive", nominal: 45.0 },
  { id: "demo-lab-01", type: "co2", location: "Engineering Lab 304", nominal: 620.0 },
  { id: "demo-lab-02", type: "temperature", location: "Cleanroom Alpha", nominal: 20.1 },
  { id: "demo-hall-01", type: "noise", location: "Student Union Main Atrium", nominal: 58.5 },
  { id: "demo-hall-02", type: "co2", location: "Lecture Hall B", nominal: 780.0 },
  { id: "demo-dorm-01", type: "power", location: "West Hall Dormitory Substation", nominal: 320.0 },
  { id: "demo-dorm-02", type: "temperature", location: "North Residence Block", nominal: 23.0 },
];

export interface DiscoveredSensor {
  id: string;
  type: string;
  source: "Active Incident" | "Rule Target";
  lastObservedValue: number | null;
  lastEventTime: string;
  isDemo?: boolean;
}

export default function SensorsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Demo Mode Toggle (Strictly false by default)
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Active Ingestion Tab: "single" or "batch"
  const [ingestionTab, setIngestionTab] = useState<"single" | "batch">("single");

  // Single Ingestion Form State (Sensible empty initial values)
  const [formSensorId, setFormSensorId] = useState("");
  const [formType, setFormType] = useState("temperature");
  const [formValue, setFormValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Batch Ingestion Form State
  const [batchJson, setBatchJson] = useState("");
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [batchFeedback, setBatchFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const loadBackendData = async () => {
    try {
      const [rulesRes, alertsRes] = await Promise.allSettled([
        api.listRules(),
        api.listAlerts(),
      ]);

      if (rulesRes.status === "fulfilled") {
        setRules(rulesRes.value);
      }
      if (alertsRes.status === "fulfilled") {
        setAlerts(alertsRes.value);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadBackendData();
    const interval = setInterval(loadBackendData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadBackendData();
  };

  // Extract Real Sensors Discovered from Alerts and Targeted Rules
  const discoveredSensors: DiscoveredSensor[] = React.useMemo(() => {
    if (isDemoMode) {
      return DEMO_CAMPUS_SENSORS.map((d) => ({
        id: d.id,
        type: d.type,
        source: "Rule Target",
        lastObservedValue: d.nominal,
        lastEventTime: "Demo Reference",
        isDemo: true,
      }));
    }

    const sensorMap = new Map<string, DiscoveredSensor>();

    // 1. Add sensors that have triggered alerts
    for (const a of alerts) {
      if (!sensorMap.has(a.sensor_id)) {
        sensorMap.set(a.sensor_id, {
          id: a.sensor_id,
          type: a.reading_type,
          source: "Active Incident",
          lastObservedValue: a.observed_value,
          lastEventTime: a.triggered_at,
          isDemo: false,
        });
      }
    }

    // 2. Add sensors targeted in specific rules
    for (const r of rules) {
      if (r.sensor_id && !sensorMap.has(r.sensor_id)) {
        sensorMap.set(r.sensor_id, {
          id: r.sensor_id,
          type: r.reading_type,
          source: "Rule Target",
          lastObservedValue: null,
          lastEventTime: r.updated_at || r.created_at,
          isDemo: false,
        });
      }
    }

    return Array.from(sensorMap.values());
  }, [alerts, rules, isDemoMode]);

  // Single Reading Ingestion Handler
  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitFeedback(null);

    const trimmedId = formSensorId.trim();
    if (!trimmedId) {
      setSubmitFeedback({
        success: false,
        message: "Sensor Identifier is required.",
      });
      setIsSubmitting(false);
      return;
    }

    const numVal = parseFloat(formValue);
    if (isNaN(numVal)) {
      setSubmitFeedback({
        success: false,
        message: "Please enter a valid numeric reading value.",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      const res = await api.ingestReading({
        sensorId: trimmedId,
        type: formType,
        value: numVal,
        timestamp: now,
      });

      setSubmitFeedback({
        success: true,
        message: `Accepted by Ingestion Buffer: ${res.accepted} reading queued into Redis at ${new Date().toLocaleTimeString()} (Worker processing asynchronously).`,
      });
      setFormValue(""); // Clear input on success
      // Refresh to capture any instantly evaluated alert
      setTimeout(loadBackendData, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitFeedback({
        success: false,
        message: msg || "Failed to submit reading to API.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Batch Reading Ingestion Handler
  const handleBatchIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingBatch(true);
    setBatchFeedback(null);

    let parsed: Array<{ sensorId: string; type: string; value: number; timestamp?: string }>;
    try {
      parsed = JSON.parse(batchJson);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Payload must be a non-empty JSON array of reading objects.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid JSON format";
      setBatchFeedback({
        success: false,
        message: `JSON Parse Error: ${msg}. Format: [{"sensorId": "s-01", "type": "temperature", "value": 25.0}]`,
      });
      setIsSubmittingBatch(false);
      return;
    }

    const now = new Date().toISOString();
    let formattedReadings: Array<{ sensorId: string; type: string; value: number; timestamp: string }>;
    try {
      formattedReadings = parsed.map((item, idx) => {
        if (!item.sensorId || !item.type || typeof item.value !== "number") {
          throw new Error(`Item at index ${idx} is missing sensorId, type, or valid numeric value.`);
        }
        return {
          sensorId: String(item.sensorId).trim(),
          type: String(item.type).trim(),
          value: Number(item.value),
          timestamp: item.timestamp || now,
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid reading item";
      setBatchFeedback({
        success: false,
        message: `Validation Error: ${msg}`,
      });
      setIsSubmittingBatch(false);
      return;
    }

    try {
      const res = await api.ingestBatch(formattedReadings);
      setBatchFeedback({
        success: true,
        message: `Accepted by Ingestion Buffer: ${res.accepted} readings queued into Redis for asynchronous processing at ${new Date().toLocaleTimeString()}.`,
      });
      setBatchJson("");
      setTimeout(loadBackendData, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBatchFeedback({
        success: false,
        message: msg || "Failed to submit batch to API.",
      });
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const filteredSensors = discoveredSensors.filter((s) => {
    const matchesSearch = s.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "all" || s.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div>
      <Header
        title="Sensor Telemetry & Monitoring"
        description="Submit real-time sensor readings and inspect active IoT nodes discovered from backend telemetry"
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDemoMode(!isDemoMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                isDemoMode
                  ? "bg-amber-50 border-amber-300 text-amber-800"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
              title="Toggle Demo Mode (shows synthetic mock campus fleet)"
            >
              {isDemoMode ? (
                <ToggleRight className="w-4 h-4 text-amber-600" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-slate-400" />
              )}
              <span>Demo Mode: {isDemoMode ? "ON" : "OFF"}</span>
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Demo Mode Notice Banner (When Demo Mode is Active) */}
        {isDemoMode && (
          <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/80 text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Demo Mode Active — Displaying Synthetic Sample Fleet</p>
              <p className="mt-0.5 text-amber-800">
                You are currently viewing 8 mock sensor reference nodes. These identifiers, campus locations, and
                nominal baselines are for UI presentation only and do not reflect real measurements. Toggle Demo Mode
                off to view actual backend telemetry.
              </p>
            </div>
          </div>
        )}

        {/* High-Throughput Architecture Notice */}
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-900">
              High-Throughput Stream Ingestion Architecture Notice
            </p>
            <p>
              TerraForge is engineered to absorb bursts of up to 10,000 readings/sec into a Redis buffer
              (`POST /api/v1/readings` and `/batch`) with asynchronous persistence to PostgreSQL. The backend
              intentionally omits an unindexed historical query or static device registration endpoint. Sensor
              activity is dynamically discovered as readings trigger alert rules or match targeted sensor configurations.
            </p>
          </div>
        </div>

        {/* Live Ingestion Test Console */}
        <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono">
                Real-Time Telemetry Ingestion Console
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Dispatch live individual or batch sensor readings directly to the FastAPI ingestion layer
              </p>
            </div>

            {/* Ingestion Type Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setIngestionTab("single")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  ingestionTab === "single"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Single Reading
              </button>
              <button
                onClick={() => setIngestionTab("batch")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  ingestionTab === "batch"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Batch Payload (JSON)
              </button>
            </div>
          </div>

          {/* Single Reading Form */}
          {ingestionTab === "single" ? (
            <form onSubmit={handleManualIngest} className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Sensor Identifier <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formSensorId}
                  onChange={(e) => setFormSensorId(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="e.g. sensor-north-01"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Telemetry Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="temperature">Temperature (°C)</option>
                  <option value="humidity">Relative Humidity (%)</option>
                  <option value="co2">Carbon Dioxide (ppm)</option>
                  <option value="noise">Noise Level (dB)</option>
                  <option value="power">Power Usage (W)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Reading Value ({getReadingUnit(formType).trim()}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="e.g. 25.4"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-4 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 h-[34px]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Dispatching..." : "Submit to API"}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Batch Ingestion Form */
            <form onSubmit={handleBatchIngest} className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    JSON Readings Array (`POST /api/v1/readings/batch`)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setBatchJson(
                        JSON.stringify(
                          [
                            { sensorId: "sensor-temp-01", type: "temperature", value: 34.5 },
                            { sensorId: "sensor-co2-01", type: "co2", value: 1150.0 },
                            { sensorId: "sensor-pow-01", type: "power", value: 420.0 },
                          ],
                          null,
                          2
                        )
                      );
                    }}
                    className="text-[10px] text-slate-500 underline hover:text-slate-800"
                  >
                    Insert Example Array
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={batchJson}
                  onChange={(e) => setBatchJson(e.target.value)}
                  placeholder={`[\n  { "sensorId": "sensor-01", "type": "temperature", "value": 26.5 }\n]`}
                  className="w-full p-2.5 rounded-md border border-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingBatch}
                className="px-4 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isSubmittingBatch ? "Submitting Batch..." : "Submit Batch to API"}</span>
              </button>
            </form>
          )}

          {/* Feedback Messages */}
          {submitFeedback && (
            <div
              className={`mt-3 p-3 rounded-md text-xs flex items-center gap-2 ${
                submitFeedback.success
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {submitFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{submitFeedback.message}</span>
            </div>
          )}

          {batchFeedback && (
            <div
              className={`mt-3 p-3 rounded-md text-xs flex items-center gap-2 ${
                batchFeedback.success
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {batchFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{batchFeedback.message}</span>
            </div>
          )}
        </div>

        {/* Discovered Sensor Activity Directory */}
        <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono flex items-center gap-2">
                <span>Active Sensor Directory</span>
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 lowercase">
                  {discoveredSensors.length} {isDemoMode ? "demo items" : "discovered nodes"}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isDemoMode
                  ? "Displaying synthetic sample campus fleet for UI demonstration"
                  : "Sensors actively discovered through backend incident alerts and targeted rule definitions"}
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter sensor ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-md border border-slate-200 text-xs w-44 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-1.5 rounded-md border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="all">All Types</option>
                <option value="temperature">Temperature</option>
                <option value="humidity">Humidity</option>
                <option value="co2">CO₂</option>
                <option value="noise">Noise</option>
                <option value="power">Power</option>
              </select>
            </div>
          </div>

          <div className="border border-slate-200 rounded-md overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Sensor ID</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Discovery Source</th>
                  <th className="px-4 py-2.5 font-medium">Last Observed Telemetry</th>
                  <th className="px-4 py-2.5 font-medium">Active Rule Coverage</th>
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-mono">
                      Querying backend telemetry and active rules...
                    </td>
                  </tr>
                ) : filteredSensors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="max-w-md mx-auto space-y-2">
                        <Radio className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold text-slate-800">
                          {searchTerm ? "No Matching Sensors Found" : "No Sensors Discovered Yet"}
                        </p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {searchTerm
                            ? "Try refining your sensor ID search query or type filter."
                            : "TerraForge operates as a streaming ingestion pipeline. Sensors appear here automatically once readings are submitted and evaluated against alert rules."}
                        </p>
                        {!searchTerm && (
                          <div className="pt-2 flex justify-center gap-3">
                            <button
                              onClick={() => {
                                setFormSensorId("sensor-aud-01");
                                setFormType("temperature");
                                setFormValue("35.0");
                                window.scrollTo({ top: 120, behavior: "smooth" });
                              }}
                              className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                            >
                              Fill Test Ingestion Form
                            </button>
                            <button
                              onClick={() => setIsDemoMode(true)}
                              className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50"
                            >
                              Enable Demo Mode
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSensors.map((s) => {
                    // Calculate real rule coverage matching this sensor
                    const sensorRules = rules.filter(
                      (r) =>
                        (r.sensor_id === s.id || !r.sensor_id) &&
                        r.reading_type === s.type &&
                        r.enabled
                    );

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-slate-900">
                          <span className="flex items-center gap-1.5">
                            {s.id}
                            {s.isDemo && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                DEMO
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-700">
                          {s.type}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                              s.source === "Active Incident"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {s.source}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {s.lastObservedValue !== null ? (
                            <span>
                              {s.lastObservedValue}
                              {getReadingUnit(s.type)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-sans text-[11px]">
                              — (Pending breach)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700">
                            <Sliders className="w-2.5 h-2.5 text-slate-500" />
                            {sensorRules.length} rule{sensorRules.length === 1 ? "" : "s"} active
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setFormSensorId(s.id);
                              setFormType(s.type);
                              setFormValue(
                                s.lastObservedValue !== null
                                  ? s.lastObservedValue.toString()
                                  : "25.0"
                              );
                              window.scrollTo({ top: 120, behavior: "smooth" });
                            }}
                            className="text-[11px] font-medium text-slate-700 hover:text-slate-950 underline"
                          >
                            Pre-fill Ingestion Form
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
