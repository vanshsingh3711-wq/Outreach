"use client";

import React from "react";
import { Activity, Clock } from "lucide-react";

export default function ActivityPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">System Activity</h1>
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300 border border-slate-700">
            Audit Trail
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Historical log of automated agent actions, outbox decisions, and sending events.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-400">
          <Activity className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-white">Event Log Operational</h3>
        <p className="max-w-md mx-auto text-xs text-slate-400">
          Every action taken by Outreach is logged to SQLite with cryptographic timestamps.
        </p>
      </div>
    </div>
  );
}
