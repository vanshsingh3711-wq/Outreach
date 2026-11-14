"use client";

import React from "react";
import { useOutreachStatus } from "@/hooks/use-outreach-status";
import { Play, Square, RefreshCw, Cpu, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const { isRunning, startOutreach, stopOutreach, isStarting, isStopping, refetchStatus, aiStatus } =
    useOutreachStatus();

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-8 backdrop-blur-xl">
      {/* Left: Backend & Engine info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[11px] text-slate-400">FastAPI :5555</span>
        </div>

        {aiStatus && (
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-300">
            <Cpu className="h-3 w-3 text-indigo-400" />
            <span>DeepSeek {aiStatus.model || "chat"}</span>
          </div>
        )}
      </div>

      {/* Right: Agent Action Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => refetchStatus()}
          title="Refresh live metrics"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>

        {isRunning ? (
          <button
            onClick={() => stopOutreach()}
            disabled={isStopping}
            className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/25 transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <Square className="h-3 w-3 fill-rose-400" />
            <span>{isStopping ? "Stopping..." : "Stop Engine"}</span>
          </button>
        ) : (
          <button
            onClick={() => startOutreach()}
            disabled={isStarting}
            className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 transition disabled:opacity-50 cursor-pointer shadow-sm shadow-emerald-500/10"
          >
            <Play className="h-3 w-3 fill-emerald-400" />
            <span>{isStarting ? "Starting..." : "Start Engine"}</span>
          </button>
        )}
      </div>
    </header>
  );
}
