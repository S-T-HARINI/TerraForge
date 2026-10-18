"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Check,
  CheckCheck,
  X,
  Info,
} from "lucide-react";
import { Header } from "@/components/Header";
import { api, Alert } from "@/lib/api";
import { formatDateTime, getReadingUnit } from "@/lib/utils";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sensorFilter, setSensorFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Alert for Details Modal
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  // Action Dialog State
  const [actionType, setActionType] = useState<"acknowledge" | "resolve" | null>(null);
  const [actionAlert, setActionAlert] = useState<Alert | null>(null);
  const [operatorName, setOperatorName] = useState("operator_alice");
  const [resolutionNote, setResolutionNote] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api.listAlerts(
      statusFilter === "all" ? undefined : statusFilter,
      sensorFilter.trim() || undefined
    )
      .then((res) => {
        if (!ignore) {
          setAlerts(res);
          setIsLoading(false);
          setIsRefreshing(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg || "Failed to retrieve alerts from backend.");
          setIsLoading(false);
          setIsRefreshing(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [statusFilter, sensorFilter]);

  const handleAcknowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionAlert) return;
    setIsSubmittingAction(true);
    setActionError(null);

    try {
      const updated = await api.acknowledgeAlert(actionAlert.id, operatorName.trim());
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setFeedbackMessage(`Alert on ${actionAlert.sensor_id} acknowledged by ${operatorName}.`);
      setActionType(null);
      setActionAlert(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || "Failed to acknowledge alert.");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionAlert) return;
    setIsSubmittingAction(true);
    setActionError(null);

    try {
      const updated = await api.resolveAlert(
        actionAlert.id,
        operatorName.trim(),
        resolutionNote.trim() || null
      );
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setFeedbackMessage(`Alert on ${actionAlert.sensor_id} successfully resolved.`);
      setActionType(null);
      setActionAlert(null);
      setResolutionNote("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || "Failed to resolve alert.");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const openCount = alerts.filter((a) => a.status === "open").length;
  const ackCount = alerts.filter((a) => a.status === "acknowledged").length;
  const resCount = alerts.filter((a) => a.status === "resolved").length;

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await api.listAlerts(
        statusFilter === "all" ? undefined : statusFilter,
        sensorFilter.trim() || undefined
      );
      setAlerts(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Failed to retrieve alerts from backend.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div>
      <Header
        title="Alert Incident Management"
        description="Inspect, acknowledge, and resolve threshold and time-window incident breaches"
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Feedback message banner */}
        {feedbackMessage && (
          <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackMessage}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-emerald-700 hover:text-emerald-900"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={handleManualRefresh} className="underline font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Filter Bar & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-200 bg-white shadow-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { label: "All Alerts", value: "all", count: alerts.length },
                { label: "Open", value: "open", count: openCount },
                { label: "Acknowledged", value: "acknowledged", count: ackCount },
                { label: "Resolved", value: "resolved", count: resCount },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  statusFilter === tab.value
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-200/60 text-slate-700">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Sensor Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search sensor ID..."
              value={sensorFilter}
              onChange={(e) => setSensorFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-md border border-slate-200 text-xs w-56 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Alerts Table */}
        <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="border border-slate-200 rounded-md overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Sensor ID</th>
                  <th className="px-4 py-2.5 font-medium">Reading Type</th>
                  <th className="px-4 py-2.5 font-medium">Observed Value</th>
                  <th className="px-4 py-2.5 font-medium">Message / Rule</th>
                  <th className="px-4 py-2.5 font-medium">Triggered At</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-mono">
                      Loading alerts from API...
                    </td>
                  </tr>
                ) : alerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-800">No Alerts Found</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        No alerts match the active status or sensor filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  alerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium capitalize ${
                            alert.status === "open"
                              ? "bg-rose-100 text-rose-700 border border-rose-200"
                              : alert.status === "acknowledged"
                              ? "bg-amber-100 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {alert.status === "open" && <AlertTriangle className="w-2.5 h-2.5" />}
                          {alert.status === "acknowledged" && <Clock className="w-2.5 h-2.5" />}
                          {alert.status === "resolved" && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                          {alert.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-900">
                        {alert.sensor_id}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-700">
                        {alert.reading_type}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {alert.observed_value}
                        <span className="font-normal text-slate-500">
                          {getReadingUnit(alert.reading_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={alert.message}>
                        {alert.message}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {formatDateTime(alert.triggered_at)}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedAlert(alert)}
                          className="px-2 py-1 rounded text-[11px] font-medium border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                        >
                          Details
                        </button>

                        {alert.status === "open" && (
                          <button
                            onClick={() => {
                              setActionAlert(alert);
                              setActionType("acknowledge");
                              setActionError(null);
                            }}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}

                        {alert.status !== "resolved" && (
                          <button
                            onClick={() => {
                              setActionAlert(alert);
                              setActionType("resolve");
                              setActionError(null);
                            }}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Action Dialog (Acknowledge / Resolve) */}
      {actionType && actionAlert && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-6 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                {actionType === "acknowledge" ? (
                  <>
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>Acknowledge Incident Alert</span>
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-4 h-4 text-emerald-600" />
                    <span>Resolve Incident Alert</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => {
                  setActionType(null);
                  setActionAlert(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={actionType === "acknowledge" ? handleAcknowledge : handleResolve}
              className="mt-4 space-y-4"
            >
              <div className="p-3 rounded-md bg-slate-50 border border-slate-100 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Sensor:</span>
                  <span className="font-mono font-medium">{actionAlert.sensor_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Breach Value:</span>
                  <span className="font-mono font-bold text-rose-600">
                    {actionAlert.observed_value}
                    {getReadingUnit(actionAlert.reading_type)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Triggered:</span>
                  <span className="font-mono">{formatDateTime(actionAlert.triggered_at)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Operator Name / Badge ID
                </label>
                <input
                  type="text"
                  required
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="e.g. operator_alice"
                />
              </div>

              {actionType === "resolve" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Resolution Note (optional)
                  </label>
                  <textarea
                    rows={3}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                    placeholder="e.g. Replaced faulty cooling fan and recalibrated sensor."
                  />
                </div>
              )}

              {actionError && (
                <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {actionError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActionType(null);
                    setActionAlert(null);
                  }}
                  className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="px-4 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium disabled:opacity-50"
                >
                  {isSubmittingAction
                    ? "Updating..."
                    : actionType === "acknowledge"
                    ? "Confirm Acknowledgment"
                    : "Confirm Resolution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Slideover / Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-6 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-600" />
                <span>Alert Incident Details</span>
              </h3>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-slate-50 border border-slate-100 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Alert ID</span>
                  <span className="text-slate-800 truncate block text-[11px]">{selectedAlert.id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Rule ID</span>
                  <span className="text-slate-800 truncate block text-[11px]">{selectedAlert.rule_id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Sensor</span>
                  <span className="text-slate-900 font-semibold">{selectedAlert.sensor_id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Observed Value</span>
                  <span className="text-rose-600 font-bold">
                    {selectedAlert.observed_value}
                    {getReadingUnit(selectedAlert.reading_type)}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Incident Message
                </span>
                <p className="p-2.5 rounded bg-slate-50 border border-slate-100 text-slate-800 font-mono text-[11px]">
                  {selectedAlert.message}
                </p>
              </div>

              {/* Lifecycle Audit trail */}
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <span className="text-[11px] font-semibold text-slate-700 block">
                  Incident Lifecycle Audit
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-600">
                  <div>Triggered: {formatDateTime(selectedAlert.triggered_at)}</div>
                  <div>Status: <span className="uppercase font-semibold">{selectedAlert.status}</span></div>
                  <div>Ack By: {selectedAlert.acknowledged_by || "—"}</div>
                  <div>Ack At: {formatDateTime(selectedAlert.acknowledged_at)}</div>
                  <div>Resolved By: {selectedAlert.resolved_by || "—"}</div>
                  <div>Resolved At: {formatDateTime(selectedAlert.resolved_at)}</div>
                </div>
              </div>

              {/* JSON Metadata Details */}
              {selectedAlert.details && Object.keys(selectedAlert.details).length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Rule Evaluation Metadata (JSON Details)
                  </span>
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-100 font-mono text-[10px] overflow-x-auto max-h-36">
                    {JSON.stringify(selectedAlert.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
