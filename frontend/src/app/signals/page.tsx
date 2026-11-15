"use client";

import React from "react";
import { Radio } from "lucide-react";

export default function SignalsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">Buying Signals</h1>
          <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 border border-sky-500/20">
            Signals Engine
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Detected external events: hiring sprees, tech stack changes, funding announcements.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400">
          <Radio className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-white">Buying Signals Monitored</h3>
        <p className="max-w-md mx-auto text-xs text-slate-400">
          Scout continuously scans hiring boards and tech stacks to trigger context-aware outreach.
        </p>
      </div>
    </div>
  );
}

