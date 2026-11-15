"use client";

import React from "react";
import { PenTool } from "lucide-react";
import Link from "next/link";

export default function OutreachPrepPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">Outreach Prep</h1>
          <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
            DeepSeek Writer
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Personalized angle generator and email drafting rules for prospects.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
          <PenTool className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-white">DeepSeek Brain Personalization Active</h3>
        <p className="max-w-md mx-auto text-xs text-slate-400">
          Emails are drafted on-demand from discovered decision-makers using your offer rules.
        </p>
        <Link
          href="/decision-makers"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/20"
        >
          <span>Open Decision-Makers</span>
        </Link>
      </div>
    </div>
  );
}

