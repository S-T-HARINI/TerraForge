"use client";

import React, { useState, useEffect } from "react";
import {
  Sliders,
  Plus,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Header } from "@/components/Header";
import { api, AlertRule, RuleType, RuleOperator } from "@/lib/api";
import { getReadingUnit } from "@/lib/utils";

export default function RulesPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sensorId, setSensorId] = useState("");
  const [readingType, setReadingType] = useState("temperature");
  const [ruleType, setRuleType] = useState<RuleType>("threshold");
  const [operator, setOperator] = useState<RuleOperator>(">");
  const [threshold, setThreshold] = useState("30.0");
  const [windowSeconds, setWindowSeconds] = useState("600");
  const [enabled, setEnabled] = useState(true);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api.listRules(enabledOnly)
      .then((res) => {
        if (!ignore) {
          setRules(res);
          setIsLoading(false);
          setIsRefreshing(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg || "Failed to load rules.");
          setIsLoading(false);
          setIsRefreshing(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [enabledOnly]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await api.listRules(enabledOnly);
      setRules(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Failed to load rules.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setName("");
    setDescription("");
    setSensorId("");
    setReadingType("temperature");
    setRuleType("threshold");
    setOperator(">");
    setThreshold("30.0");
    setWindowSeconds("600");
    setEnabled(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: AlertRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setDescription(rule.description || "");
    setSensorId(rule.sensor_id || "");
    setReadingType(rule.reading_type);
    setRuleType(rule.rule_type);
    setOperator(rule.operator);
    setThreshold(rule.threshold.toString());
    setWindowSeconds(rule.window_seconds ? rule.window_seconds.toString() : "600");
    setEnabled(rule.enabled);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleRule = async (rule: AlertRule) => {
    try {
      if (rule.enabled) {
        const updated = await api.disableRule(rule.id);
        setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setFeedback(`Rule "${rule.name}" disabled.`);
      } else {
        const updated = await api.enableRule(rule.id);
        setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setFeedback(`Rule "${rule.name}" enabled.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Failed to toggle rule state.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const numThreshold = parseFloat(threshold);
    if (isNaN(numThreshold)) {
      setFormError("Threshold must be a valid number.");
      setIsSubmitting(false);
      return;
    }

    let numWindow: number | null = null;
    if (ruleType === "time_window") {
      numWindow = parseInt(windowSeconds, 10);
      if (isNaN(numWindow) || numWindow < 1 || numWindow > 86400) {
        setFormError("Window duration must be between 1 and 86400 seconds (24 hours).");
        setIsSubmitting(false);
        return;
      }
    }

    try {
      if (editingRule) {
        const updated = await api.updateRule(editingRule.id, {
          name: name.trim(),
          description: description.trim() || null,
          sensor_id: sensorId.trim() || null,
          reading_type: readingType,
          rule_type: ruleType,
          operator,
          threshold: numThreshold,
          window_seconds: ruleType === "time_window" ? numWindow : null,
          enabled,
        });
        setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setFeedback(`Rule "${updated.name}" updated successfully.`);
      } else {
        const created = await api.createRule({
          name: name.trim(),
          description: description.trim() || null,
          sensor_id: sensorId.trim() || null,
          reading_type: readingType,
          rule_type: ruleType,
          operator,
          threshold: numThreshold,
          window_seconds: ruleType === "time_window" ? numWindow : null,
          enabled,
        });
        setRules((prev) => [created, ...prev]);
        setFeedback(`Rule "${created.name}" created successfully.`);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(msg || "Failed to save rule.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Header
        title="Alert-Rule Management"
        description="Configure instantaneous threshold rules and sliding time-window rolling average conditions"
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        actions={
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Rule</span>
          </button>
        }
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {feedback && (
          <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedback}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-emerald-700">
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

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-xs">
            <span className="text-[11px] font-mono text-slate-500 uppercase">Total Rules</span>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{rules.length}</div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-xs">
            <span className="text-[11px] font-mono text-slate-500 uppercase">Active / Enabled</span>
            <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
              {rules.filter((r) => r.enabled).length}
            </div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-xs">
            <span className="text-[11px] font-mono text-slate-500 uppercase">Time-Window Rules</span>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {rules.filter((r) => r.rule_type === "time_window").length}
            </div>
          </div>
        </div>

        {/* Filter & Table Container */}
        <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledOnly}
                  onChange={(e) => setEnabledOnly(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Show enabled only</span>
              </label>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {rules.length} rule{rules.length === 1 ? "" : "s"} registered
            </span>
          </div>

          <div className="border border-slate-200 rounded-md overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Rule Name</th>
                  <th className="px-4 py-2.5 font-medium">Target Type</th>
                  <th className="px-4 py-2.5 font-medium">Sensor Scope</th>
                  <th className="px-4 py-2.5 font-medium">Evaluation Condition</th>
                  <th className="px-4 py-2.5 font-medium">Window Duration</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-mono">
                      Loading rules...
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      No alert rules found. Click &quot;Create Rule&quot; to define a new policy.
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleRule(rule)}
                          className="flex items-center gap-1 text-[11px] font-mono"
                          title="Click to toggle rule state"
                        >
                          {rule.enabled ? (
                            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              <Check className="w-2.5 h-2.5" />
                              Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                              <X className="w-2.5 h-2.5" />
                              Disabled
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div>{rule.name}</div>
                        {rule.description && (
                          <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs">
                            {rule.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-700">
                        {rule.reading_type}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 text-[11px]">
                        {rule.sensor_id ? rule.sensor_id : <span className="text-slate-400">All Sensors (Global)</span>}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-800">
                        {rule.rule_type === "threshold" ? "Instant" : "Rolling Avg"}{" "}
                        <span className="text-slate-500">{rule.operator}</span>{" "}
                        <span className="text-slate-900 font-bold">{rule.threshold}</span>
                        <span className="text-slate-500 font-normal">
                          {getReadingUnit(rule.reading_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 text-[11px]">
                        {rule.rule_type === "time_window" ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {rule.window_seconds}s ({(rule.window_seconds || 0) / 60}m)
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEditModal(rule)}
                          className="px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create / Edit Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-6 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-700" />
                <span>{editingRule ? "Edit Alert Rule" : "Create Alert Rule"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="e.g. Critical Lab Temperature"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="e.g. Alert when cleanroom temp breaches safety window"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Reading Type *
                  </label>
                  <select
                    value={readingType}
                    onChange={(e) => setReadingType(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="temperature">Temperature (°C)</option>
                    <option value="humidity">Humidity (%)</option>
                    <option value="co2">CO₂ (ppm)</option>
                    <option value="noise">Noise (dB)</option>
                    <option value="power">Power (W)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Sensor ID (optional)
                  </label>
                  <input
                    type="text"
                    value={sensorId}
                    onChange={(e) => setSensorId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                    placeholder="Global (blank) or ID"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Evaluation Model *
                  </label>
                  <select
                    value={ruleType}
                    onChange={(e) => setRuleType(e.target.value as RuleType)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="threshold">Single Reading Threshold</option>
                    <option value="time_window">Time-Window Rolling Avg</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Operator *
                  </label>
                  <select
                    value={operator}
                    onChange={(e) => setOperator(e.target.value as RuleOperator)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value=">">&gt; (Greater than)</option>
                    <option value=">=">&gt;= (Greater or equal)</option>
                    <option value="<">&lt; (Less than)</option>
                    <option value="<=">&lt;= (Less or equal)</option>
                    <option value="==">== (Exact match)</option>
                    <option value="!=">!= (Not equal)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Threshold Value * ({getReadingUnit(readingType).trim()})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                    placeholder="30.0"
                  />
                </div>

                <div>
                  <label
                    className={`block text-xs font-medium mb-1 ${
                      ruleType === "time_window" ? "text-slate-700" : "text-slate-300"
                    }`}
                  >
                    Window Duration (Seconds) *
                  </label>
                  <input
                    type="number"
                    disabled={ruleType !== "time_window"}
                    value={windowSeconds}
                    onChange={(e) => setWindowSeconds(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50 disabled:text-slate-300"
                    placeholder="600"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>Enable rule immediately upon save</span>
                </label>
              </div>

              {formError && (
                <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
