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
} from "lucide-react";

export default function ControlsPage() {
  const { status, isRunning, pid, startOutreach, stopOutreach, isStarting, isStopping } =
    useOutreachStatus();

  const [logFilter, setLogFilter] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  const { data: logsData, refetch: refetchLogs } = useQuery<{ lines: string[] }>({
    queryKey: ["outreach-logs"],
    queryFn: () => fetchApi<{ lines: string[] }>("/api/outreach/logs"),
    refetchInterval: 2000,
  });

  const lines = logsData?.lines || [];
  const filteredLines = logFilter
    ? lines.filter((l) => l.toLowerCase().includes(logFilter.toLowerCase()))
    : lines;

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [filteredLines, autoScroll]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Agent Controls & Telemetry</h1>
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
            Monitor the autonomous daemon subprocess, inspect raw execution traces, and manage lifecycle.
          </p>
        </div>

        {/* Action button */}
        <div>
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

      {/* Process Spec Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Cpu className="h-4 w-4 text-sky-400" />
            <span>Process Status</span>
          </div>
          <div className="mt-3 text-lg font-bold text-white">
            {isRunning ? "Active Heartbeat" : "Idle"}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {isRunning ? `PID: ${pid} managed via data/pid` : "Standby mode ready for launch"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Layers className="h-4 w-4 text-indigo-400" />
            <span>Active Model</span>
          </div>
          <div className="mt-3 text-lg font-bold text-white">DeepSeek Chat</div>
          <p className="mt-1 text-[11px] text-slate-400">
            Native DeepSeek API (deepseek-chat)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <span>Log File Destination</span>
          </div>
          <div className="mt-3 font-mono text-sm text-slate-200 truncate">
            data/outreach.log
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Rolling execution & agent thinking log
          </p>
        </div>
      </div>

      {/* Terminal Window */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        {/* Terminal Header Bar */}
        <div className="flex flex-col gap-3 border-b border-slate-800/80 bg-slate-900/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="ml-2 font-mono text-xs text-slate-400">outreach.log — live tail</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search filter in logs */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 py-1 pl-8 pr-3 font-mono text-[11px] text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-mono transition ${
                autoScroll
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-slate-700 bg-slate-800 text-slate-400"
              }`}
            >
              <ArrowDownCircle className="h-3.5 w-3.5" />
              <span>Auto-scroll</span>
            </button>

            <button
              onClick={() => refetchLogs()}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal Body */}
        <div
          ref={terminalRef}
          className="h-[480px] overflow-y-auto p-4 font-mono text-[11px] leading-relaxed text-slate-300 space-y-1 select-text"
        >
          {filteredLines.length === 0 ? (
            <div className="py-20 text-center text-slate-600">
              No log lines found {logFilter && `matching "${logFilter}"`}.
            </div>
          ) : (
            filteredLines.map((line, idx) => {
              const isError = /error|fail|exception|fatal/i.test(line);
              const isWarn = /warning|warn/i.test(line);
              const isSuccess = /success|sent|approved|verified/i.test(line);
              const isThinking = /thinking|scout|brain|writer/i.test(line);

              let textColor = "text-slate-300";
              if (isError) textColor = "text-rose-400";
              else if (isWarn) textColor = "text-amber-400";
              else if (isSuccess) textColor = "text-emerald-400";
              else if (isThinking) textColor = "text-sky-400";

              return (
                <div key={idx} className={`font-mono ${textColor} hover:bg-slate-900/60 px-1 rounded`}>
                  {line}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
