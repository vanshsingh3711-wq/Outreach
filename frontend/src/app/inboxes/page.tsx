"use client";

import React from "react";
import { Inbox, CheckCircle2 } from "lucide-react";

export default function InboxesPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">Inboxes & Warmup</h1>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            Health Check
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Email deliverability monitoring, SPF, DKIM, and DMARC verification.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <Inbox className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-white">Mailbox Deliverability Healthy</h3>
        <p className="max-w-md mx-auto text-xs text-slate-400">
          Your configured mailboxes are authenticated and ready for safe outbound distribution.
        </p>
      </div>
    </div>
  );
}

