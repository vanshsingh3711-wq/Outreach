"use client";

import React from "react";
import { ChevronRight } from "lucide-react";

export default function CampaignsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">Outbound Campaigns</h1>
          <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
            Multi-Touch
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Campaign cohorts, follow-up cadence spacing, and multi-step sequence progression.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center space-y-3">
        <h3 className="text-base font-semibold text-white">Campaign Cadence Managed</h3>
        <p className="max-w-md mx-auto text-xs text-slate-400">
          Prospects follow automated 3-step follow-up schedules with human objection handling.
        </p>
      </div>
    </div>
  );
}
