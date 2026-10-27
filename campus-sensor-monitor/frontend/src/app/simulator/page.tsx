"use client";

import React, { useState } from "react";
import {
  Zap,
  Play,
  Info,
} from "lucide-react";
import { Header } from "@/components/Header";
import { api, SensorReadingPayload } from "@/lib/api";

const DEFAULT_SIM_POOL = [
  "sensor-sim-01",
  "sensor-sim-02",
  "sensor-sim-03",
  "sensor-sim-04",
  "sensor-sim-05",
  "sensor-sim-06",
  "sensor-sim-07",
  "sensor-sim-08",
];

const RANGES: Record<string, { min: number; max: number; spikeMin: number; spikeMax: number }> = {
  temperature: { min: 18.0, max: 28.0, spikeMin: 35.0, spikeMax: 50.0 },
  humidity: { min: 30.0, max: 60.0, spikeMin: 75.0, spikeMax: 95.0 },
  co2: { min: 400.0, max: 900.0, spikeMin: 1200.0, spikeMax: 2500.0 },
  noise: { min: 35.0, max: 70.0, spikeMin: 85.0, spikeMax: 120.0 },
  power: { min: 100.0, max: 500.0, spikeMin: 800.0, spikeMax: 1500.0 },
};

export default function SimulatorPage() {
  const [selectedType, setSelectedType] = useState<string>("temperature");
  const [targetSensor, setTargetSensor] = useState<string>("random");
  const [customSensorId, setCustomSensorId] = useState<string>("sensor-test-01");
  const [batchSize, setBatchSize] = useState<number>(100);
  const [totalBatches, setTotalBatches] = useState<number>(5);
  const [anomalyRatio, setAnomalyRatio] = useState<number>(10); // 10%
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Results & Logs
  const [progress, setProgress] = useState<number>(0);
  const [totalAccepted, setTotalAccepted] = useState<number>(0);
  const [totalFailed, setTotalFailed] = useState<number>(0);
  const [elapsedTimeMs, setElapsedTimeMs] = useState<number>(0);
  const [throughput, setThroughput] = useState<number>(0);
  const [logs, setLogs] = useState<Array<{ id: number; text: string; time: string; success: boolean }>>([]);

  const addLog = (text: string, success: boolean) => {
    setLogs((prev) => [
      {
        id: Date.now() + Math.random(),
        text,
        time: new Date().toLocaleTimeString(),
        success,
      },
      ...prev.slice(0, 99),
    ]);
  };

  const generateBatchPayload = (count: number): SensorReadingPayload[] => {
    const config = RANGES[selectedType] || RANGES.temperature;
    const now = new Date().toISOString();
    const batch: SensorReadingPayload[] = [];

    for (let i = 0; i < count; i++) {
      const isSpike = Math.random() < anomalyRatio / 100;
      let val: number;
      if (isSpike) {
        val = Number((Math.random() * (config.spikeMax - config.spikeMin) + config.spikeMin).toFixed(2));
      } else {
        val = Number((Math.random() * (config.max - config.min) + config.min).toFixed(2));
      }

      const sensor =
        targetSensor === "random"
          ? DEFAULT_SIM_POOL[Math.floor(Math.random() * DEFAULT_SIM_POOL.length)]
          : targetSensor === "custom"
          ? (customSensorId.trim() || "sensor-test-01")
          : targetSensor;

      batch.push({
        sensorId: sensor,
        type: selectedType,
        value: val,
        timestamp: now,
      });
    }

    return batch;
  };

  const handleRunSimulator = async () => {
    setIsRunning(true);
    setProgress(0);
    setTotalAccepted(0);
    setTotalFailed(0);
    setLogs([]);
    const startTime = performance.now();

    let accepted = 0;
    let failed = 0;

    addLog(`Initiating simulation: ${totalBatches} batches of ${batchSize} (${totalBatches * batchSize} total readings)...`, true);

    for (let b = 1; b <= totalBatches; b++) {
      const payload = generateBatchPayload(batchSize);
      const batchStart = performance.now();
      try {
        const res = await api.ingestBatch(payload);
        const batchLatency = (performance.now() - batchStart).toFixed(1);
        accepted += res.accepted;
        setTotalAccepted(accepted);
        addLog(`Batch #${b} accepted (${res.accepted} readings) in ${batchLatency} ms`, true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        failed += batchSize;
        setTotalFailed(failed);
        addLog(`Batch #${b} rejected: ${msg}`, false);
      }

      setProgress(Math.round((b / totalBatches) * 100));
    }

    const totalElapsed = performance.now() - startTime;
    setElapsedTimeMs(totalElapsed);
    const calculatedThroughput = accepted / (totalElapsed / 1000);
    setThroughput(calculatedThroughput);

    addLog(
      `Simulation finished in ${(totalElapsed / 1000).toFixed(2)}s. Accepted: ${accepted}, Failed: ${failed}. Throughput: ${calculatedThroughput.toFixed(0)} readings/sec.`,
      failed === 0
    );

    setIsRunning(false);
  };

  const handle10kBurst = async () => {
    // Use local constants — setBatchSize/setTotalBatches are async so
    // reading state immediately after setting it would yield stale values.
    const BURST_BATCH_SIZE = 1000;
    const BURST_TOTAL_BATCHES = 10;

    setBatchSize(BURST_BATCH_SIZE);
    setTotalBatches(BURST_TOTAL_BATCHES);
    setIsRunning(true);
    setProgress(0);
    setTotalAccepted(0);
    setTotalFailed(0);
    setLogs([]);

    addLog("Initiating 10,000 Readings Burst Test (10 batches x 1,000 readings concurrently)...", true);
    const startTime = performance.now();

    const batches = Array.from({ length: BURST_TOTAL_BATCHES }, () => generateBatchPayload(BURST_BATCH_SIZE));
    let accepted = 0;
    let failed = 0;

    const promises = batches.map(async (batch, idx) => {
      const bStart = performance.now();
      try {
        const res = await api.ingestBatch(batch);
        const lat = (performance.now() - bStart).toFixed(1);
        accepted += res.accepted;
        addLog(`Concurrent Batch #${idx + 1} (1,000 readings) accepted in ${lat} ms`, true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        failed += BURST_BATCH_SIZE;
        addLog(`Concurrent Batch #${idx + 1} failed: ${msg}`, false);
      }
    });

    await Promise.all(promises);
    const totalElapsed = performance.now() - startTime;
    setElapsedTimeMs(totalElapsed);
    const calculatedThroughput = accepted / (totalElapsed / 1000);
    setThroughput(calculatedThroughput);
    setTotalAccepted(accepted);
    setTotalFailed(failed);
    setProgress(100);

    addLog(
      `10,000 Burst Test Completed! Elapsed: ${(totalElapsed / 1000).toFixed(3)}s. Ingestion Rate: ${calculatedThroughput.toFixed(0)} readings/sec.`,
      failed === 0
    );

    setIsRunning(false);
  };

  return (
    <div>
      <Header
        title="IoT Sensor Simulator & Burst Benchmark"
        description="Generate synthetic campus telemetry and test high-throughput ingestion against the live API"
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Architecture Note */}
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-900">
              Simulated Telemetry Ingestion Disclaimer
            </p>
            <p>
              Data dispatched from this console is explicitly labeled as simulated telemetry.
              The API acknowledges payloads into Redis with `HTTP 202 Accepted`; persistence into PostgreSQL
              and alert rule evaluation occur asynchronously in worker processes.
            </p>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 p-5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono">
                Simulator Configuration
              </h2>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                Client-Side Generator
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Telemetry Type
              </label>
              <select
                value={selectedType}
                disabled={isRunning}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="temperature">Temperature (18 - 28 °C)</option>
                <option value="humidity">Humidity (30 - 60 %)</option>
                <option value="co2">CO₂ (400 - 900 ppm)</option>
                <option value="noise">Noise (35 - 70 dB)</option>
                <option value="power">Power (100 - 500 W)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Sensor Scope
              </label>
              <select
                value={targetSensor}
                disabled={isRunning}
                onChange={(e) => setTargetSensor(e.target.value)}
                className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="random">Randomize (sensor-sim-01 ... 08)</option>
                <option value="custom">Custom Sensor ID...</option>
                {DEFAULT_SIM_POOL.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {targetSensor === "custom" && (
                <div className="mt-2">
                  <input
                    type="text"
                    disabled={isRunning}
                    value={customSensorId}
                    onChange={(e) => setCustomSensorId(e.target.value)}
                    placeholder="e.g. sensor-custom-01"
                    className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Readings / Batch
                </label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  disabled={isRunning}
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Total Batches
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  disabled={isRunning}
                  value={totalBatches}
                  onChange={(e) => setTotalBatches(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Anomaly Injection Ratio</span>
                <span className="font-mono text-slate-500">{anomalyRatio}% spikes</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                disabled={isRunning}
                value={anomalyRatio}
                onChange={(e) => setAnomalyRatio(parseInt(e.target.value, 10))}
                className="w-full accent-slate-900"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Forces reading values above normal thresholds to trigger alert rules.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={handleRunSimulator}
                disabled={isRunning}
                className="w-full px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>
                  {isRunning ? "Simulating..." : `Start Simulation (${batchSize * totalBatches} readings)`}
                </span>
              </button>

              <button
                onClick={handle10kBurst}
                disabled={isRunning}
                className="w-full px-4 py-2 rounded-md border border-slate-900 text-slate-900 hover:bg-slate-100 text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Run 10,000 Burst Benchmark</span>
              </button>
            </div>
          </div>

          {/* Live Monitor & Metrics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Progress Card */}
            <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono">
                  Benchmark Metrics
                </h3>
                <span className="text-[11px] font-mono text-slate-500">
                  {progress}% Complete
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-5">
                <div
                  className="bg-slate-900 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-md bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Accepted</span>
                  <span className="text-lg font-bold font-mono text-emerald-600 block mt-0.5">
                    {totalAccepted}
                  </span>
                </div>
                <div className="p-3 rounded-md bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Rejected</span>
                  <span className="text-lg font-bold font-mono text-rose-600 block mt-0.5">
                    {totalFailed}
                  </span>
                </div>
                <div className="p-3 rounded-md bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Elapsed</span>
                  <span className="text-lg font-bold font-mono text-slate-900 block mt-0.5">
                    {(elapsedTimeMs / 1000).toFixed(2)}s
                  </span>
                </div>
                <div className="p-3 rounded-md bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Throughput</span>
                  <span className="text-lg font-bold font-mono text-slate-900 block mt-0.5">
                    {throughput > 0 ? `${throughput.toFixed(0)}/s` : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Ingestion Stream Console Log */}
            <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono">
                  Ingestion Event Console
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  {logs.length} events logged
                </span>
              </div>

              <div className="h-56 overflow-y-auto rounded-md bg-slate-900 p-3 font-mono text-[11px] space-y-1.5 text-slate-300">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                    Ready to simulate. Click &quot;Start Simulation&quot; to stream readings to the backend.
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2">
                      <span className="text-slate-500 shrink-0">[{log.time}]</span>
                      <span
                        className={
                          log.success ? "text-emerald-400" : "text-rose-400 font-semibold"
                        }
                      >
                        {log.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
