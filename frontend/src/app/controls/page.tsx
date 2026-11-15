"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOutreachStatus } from "@/hooks/use-outreach-status";
import { fetchApi } from "@/lib/api-client";
import {
  Terminal,
  Play,
  Square,
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle,
  Cpu,
  Layers,
  ArrowDownCircle,
  Copy,
  Check,
  Download,
  Trash2,
  Filter,
  Activity,
  Sparkles,
} from "lucide-react";

export default function ControlsPage() {
  const { isRunning, pid, startOutreach, stopOutreach, isStarting, isStopping } =
    useOutreachStatus();

  const [logFilter, setLogFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "error" | "brain" | "dispatch">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [cleared, setCleared] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Live status query for agent steps and next actions
  const { data: liveStatusData } = useQuery<any>({
    queryKey: ["live-status"],
    queryFn: () => fetchApi("/api/live-status"),
    refetchInterval: 3000,
  });

  // Logs stream query
  const { data: logsData, refetch: refetchLogs } = useQuery<{ lines: string[] }>({
    queryKey: ["outreach-logs"],
    queryFn: () => fetchApi<{ lines: string[] }>("/api/outreach/logs"),
    refetchInterval: 1500,
  });

  const rawLines = cleared ? [] : logsData?.lines || [];

  // Filter lines by level and text
  const filteredLines = rawLines.filter((line) => {
    // Text search filter
    if (logFilter && !line.toLowerCase().includes(logFilter.toLowerCase())) {
      return false;
    }

    // Category / Level filter
    if (levelFilter === "error") {
      return /error|fail|exception|fatal|traceback|reject/i.test(line);
    }
    if (levelFilter === "brain") {
      return /brain|deepseek|think|model|writer|prompt/i.test(line);
    }
    if (levelFilter === "dispatch") {
      return /send|dispatch|outbox|email|sent/i.test(line);
    }

    return true;
  });

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [filteredLines, autoScroll]);

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(filteredLines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const blob = new Blob([filteredLines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `outreach-log-${new Date().toISOString().slice(0, 19)}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearBuffer = () => {
    setCleared(true);
  };

  const handleRestoreBuffer = () => {
    setCleared(false);
    refetchLogs();
  };

  const nextAction = liveStatusData?.next || (isRunning ? "Agent actively polling routines." : "Standby.");

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title & Process Controller */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Agent Controls & Terminal</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isRunning
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
              }`}
            >
              {isRunning ? `Running (PID ${pid})` : "Stopped"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Real-time process execution supervisor, daemon lifecycle controls, and live execution traces.
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={() => stopOutreach()}
              disabled={isStopping}
              className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 transition cursor-pointer disabled:opacity-50"
            >
              <Square className="h-4 w-4 fill-rose-400" />
              <span>{isStopping ? "Halting daemon..." : "Stop Agent Daemon"}</span>
            </button>
          ) : (
            <button
              onClick={() => startOutreach()}
              disabled={isStarting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25 hover:opacity-95 transition cursor-pointer disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>{isStarting ? "Spawning daemon..." : "Start Agent Daemon"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Subprocess Health & Mission Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Daemon State</span>
            <Cpu className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isRunning ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span>{isRunning ? "Active Heartbeat" : "Halted / Idle"}</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {isRunning ? `Bound to PID ${pid} via data/pid` : "Standby awaiting invocation"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Current Mission Step</span>
            <Activity className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-xs font-medium text-slate-200 line-clamp-1">{nextAction}</div>
          <p className="text-[11px] text-slate-400">Derived dynamically from SQLite state</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Log Destination</span>
            <Terminal className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="font-mono text-xs text-slate-200">data/outreach.log</div>
          <p className="text-[11px] text-slate-400">64KB tail sliding-window buffer</p>
        </div>
      </div>

      {/* Advanced Virtual Log Terminal */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        {/* Terminal Header Bar */}
        <div className="flex flex-col gap-3 border-b border-slate-800/80 bg-slate-900/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="ml-2 font-mono text-xs text-slate-400">
              outreach.log — {filteredLines.length} lines
            </span>
          </div>

          {/* Quick Level Filter Tabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLevelFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-mono transition ${
                levelFilter === "all"
                  ? "bg-slate-800 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setLevelFilter("error")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-mono transition ${
                levelFilter === "error"
                  ? "bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30"
                  : "text-slate-400 hover:text-rose-300"
              }`}
            >
              Errors
            </button>
            <button
              onClick={() => setLevelFilter("brain")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-mono transition ${
                levelFilter === "brain"
                  ? "bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30"
                  : "text-slate-400 hover:text-indigo-300"
              }`}
            >
              DeepSeek Brain
            </button>
            <button
              onClick={() => setLevelFilter("dispatch")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-mono transition ${
                levelFilter === "dispatch"
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                  : "text-slate-400 hover:text-emerald-300"
              }`}
            >
              Outbox / Sends
            </button>
          </div>

          {/* Terminal Actions */}
          <div className="flex items-center gap-2">
            {/* Search filter in logs */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search logs..."
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 py-1 pl-8 pr-3 font-mono text-[11px] text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none w-36 sm:w-44"
              />
            </div>

            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              title={autoScroll ? "Auto-scroll enabled" : "Auto-scroll paused"}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-mono transition ${
                autoScroll
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-slate-700 bg-slate-800 text-slate-400"
              }`}
            >
              <ArrowDownCircle className="h-3.5 w-3.5" />
            </button>

            {/* Compact Toggle */}
            <button
              onClick={() => setIsCompact(!isCompact)}
              title={isCompact ? "Normal line height" : "Compact view"}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-mono text-slate-300 hover:text-white"
            >
              {isCompact ? "Comfortable" : "Compact"}
            </button>

            {/* Copy button */}
            <button
              onClick={handleCopyLogs}
              title="Copy filtered logs"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>

            {/* Download button */}
            <button
              onClick={handleDownloadLogs}
              title="Download raw logs"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            {/* Clear / Restore buffer button */}
            {cleared ? (
              <button
                onClick={handleRestoreBuffer}
                title="Restore logs buffer"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/15 text-sky-400 hover:text-sky-300 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={handleClearBuffer}
                title="Clear current view"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-rose-400 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Terminal Body */}
        <div
          ref={terminalRef}
          className={`h-[520px] overflow-y-auto p-4 font-mono select-text space-y-0.5 ${
            isCompact ? "text-[10px] leading-tight" : "text-[11px] leading-relaxed"
          }`}
        >
          {filteredLines.length === 0 ? (
            <div className="py-24 text-center text-slate-600 font-mono text-xs">
              {cleared ? (
                <div>
                  <p>Buffer cleared.</p>
                  <button
                    onClick={handleRestoreBuffer}
                    className="mt-2 text-sky-400 hover:underline"
                  >
                    Click to restore live feed
                  </button>
                </div>
              ) : (
                <p>No log lines found {logFilter && `matching "${logFilter}"`}.</p>
              )}
            </div>
          ) : (
            filteredLines.map((line, idx) => {
              const isError = /error|fail|exception|fatal|traceback|reject/i.test(line);
              const isWarn = /warning|warn|holding/i.test(line);
              const isSuccess = /success|sent|approved|verified/i.test(line);
              const isBrain = /brain|deepseek|thinking|writer|scout/i.test(line);

              let textColor = "text-slate-300";
              let bgColor = "";
              if (isError) {
                textColor = "text-rose-400";
                bgColor = "bg-rose-950/20";
              } else if (isWarn) {
                textColor = "text-amber-400";
                bgColor = "bg-amber-950/20";
              } else if (isSuccess) {
                textColor = "text-emerald-400";
              } else if (isBrain) {
                textColor = "text-sky-400";
              }

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-3 rounded px-1.5 py-0.5 hover:bg-slate-900/60 transition ${bgColor}`}
                >
                  <span className="select-none text-[10px] text-slate-600 shrink-0 w-8 text-right font-mono">
                    {idx + 1}
                  </span>
                  <span className={`${textColor} break-all whitespace-pre-wrap flex-1`}>{line}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
