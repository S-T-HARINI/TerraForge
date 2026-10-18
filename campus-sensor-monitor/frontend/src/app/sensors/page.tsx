"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  Search,
  Info,
  CheckCircle2,
  AlertCircle,
  Sliders,
} from "lucide-react";
import { Header } from "@/components/Header";
import { api, AlertRule } from "@/lib/api";
import { getReadingUnit } from "@/lib/utils";

const DEFAULT_CAMPUS_SENSORS = [
  { id: "sensor-lib-01", type: "temperature", location: "Library - 1st Floor East", nominal: 22.4 },
  { id: "sensor-lib-02", type: "humidity", location: "Library - Rare Books Archive", nominal: 45.0 },
  { id: "sensor-lab-01", type: "co2", location: "Engineering Lab 304", nominal: 620.0 },
  { id: "sensor-lab-02", type: "temperature", location: "Cleanroom Alpha", nominal: 20.1 },
  { id: "sensor-hall-01", type: "noise", location: "Student Union Main Atrium", nominal: 58.5 },
  { id: "sensor-hall-02", type: "co2", location: "Lecture Hall B", nominal: 780.0 },
  { id: "sensor-dorm-01", type: "power", location: "West Hall Dormitory Substation", nominal: 320.0 },
  { id: "sensor-dorm-02", type: "temperature", location: "North Residence Block", nominal: 23.0 },
];

export default function SensorsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  // Manual Ingestion Form State
  const [formSensorId, setFormSensorId] = useState("sensor-lib-01");
  const [formType, setFormType] = useState("temperature");
  const [formValue, setFormValue] = useState("24.5");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    let ignore = false;
    api.listRules()
      .then((res) => {
        if (!ignore) setRules(res);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitFeedback(null);

    const numVal = parseFloat(formValue);
    if (isNaN(numVal)) {
      setSubmitFeedback({ success: false, message: "Please enter a valid numeric value" });
      setIsSubmitting(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      const res = await api.ingestReading({
        sensorId: formSensorId.trim(),
        type: formType,
        value: numVal,
        timestamp: now,
      });

      setSubmitFeedback({
        success: true,
        message: `${res.message} (Accepted count: ${res.accepted}) at ${now}`,
      });
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

  const filteredSensors = DEFAULT_CAMPUS_SENSORS.filter((s) => {
    const matchesSearch =
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "all" || s.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div>
      <Header
        title="Sensor Telemetry & Monitoring"
        description="Inspect monitored campus sensors, verify telemetry specifications, and submit test readings"
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Architecture Note on Backend Query Capabilities */}
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-900">
              High-Throughput Stream Ingestion Architecture Notice
            </p>
            <p>
              In accordance with TerraForge&apos;s architectural objectives, sensor readings are buffered into
              Redis via high-throughput endpoints (`POST /api/v1/readings` and `/batch`) and consumed
              asynchronously by background workers. The backend purposefully does not expose an unindexed,
              ad-hoc historical reading query endpoint to preserve streaming performance. Use the live submission form below
              or the Sensor Simulator to exercise ingestion and inspect resulting alerts.
            </p>
          </div>
        </div>

        {/* Live Ingestion Test Console */}
        <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono">
                Live Single Reading Ingestion Test
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Dispatch an individual reading payload directly to the live backend API (`POST /api/v1/readings`)
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live API Connected
            </span>
          </div>

          <form onSubmit={handleManualIngest} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">
                Sensor Identifier
              </label>
              <input
                type="text"
                value={formSensorId}
                onChange={(e) => setFormSensorId(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                placeholder="e.g. sensor-lib-01"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">
                Reading Type
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="temperature">Temperature (°C)</option>
                <option value="humidity">Humidity (%)</option>
                <option value="co2">Carbon Dioxide (ppm)</option>
                <option value="noise">Noise (dB)</option>
                <option value="power">Power (W)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">
                Value ({getReadingUnit(formType).trim()})
              </label>
              <input
                type="number"
                step="0.01"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                placeholder="25.0"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 h-[34px]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Dispatching..." : "Send to API"}</span>
              </button>
            </div>
          </form>

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
        </div>

        {/* Sensor Directory & Configured Monitored Units */}
        <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono">
                Campus Sensor Directory
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Installed physical IoT nodes and associated alert-rule coverage
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
                  <th className="px-4 py-2.5 font-medium">Location</th>
                  <th className="px-4 py-2.5 font-medium">Nominal Baseline</th>
                  <th className="px-4 py-2.5 font-medium">Rule Coverage</th>
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSensors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No matching sensors found.
                    </td>
                  </tr>
                ) : (
                  filteredSensors.map((s) => {
                    const sensorRules = rules.filter(
                      (r) =>
                        (r.sensor_id === s.id || !r.sensor_id) &&
                        r.reading_type === s.type &&
                        r.enabled
                    );

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-slate-900">
                          {s.id}
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-700">
                          {s.type}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {s.location}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {s.nominal}
                          {getReadingUnit(s.type)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700">
                            <Sliders className="w-2.5 h-2.5 text-slate-500" />
                            {sensorRules.length} rule{sensorRules.length === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setFormSensorId(s.id);
                              setFormType(s.type);
                              setFormValue(s.nominal.toString());
                              window.scrollTo({ top: 150, behavior: "smooth" });
                            }}
                            className="text-[11px] font-medium text-slate-700 hover:text-slate-950 underline"
                          >
                            Fill Form
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
