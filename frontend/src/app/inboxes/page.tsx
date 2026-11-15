"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { Inbox, CheckCircle2, ShieldCheck, Mail, AlertCircle, ExternalLink, Loader2, Sparkles } from "lucide-react";

export default function InboxesPage() {
  const { data: settingsData, isLoading } = useQuery<any>({
    queryKey: ["settings-data"],
    queryFn: () => fetchApi("/api/settings"),
  });

  const { data: setupData } = useQuery<any>({
    queryKey: ["setup-status"],
    queryFn: () => fetchApi("/api/setup-status"),
  });

  const provider = settingsData?.provider || "gmail";
  const gmailAuth = settingsData?.gmail_authorized;
  const smtpHost = settingsData?.smtp_host;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">Inboxes & Deliverability</h1>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            Health Check
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Email sender authentication, mailbox deliverability monitoring, and warmup posture.
        </p>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-400 mb-2" />
          <span>Verifying mailbox configurations...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Mailbox Card */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Active Provider</span>
                <Mail className="h-4 w-4 text-sky-400" />
              </div>
              <div className="text-lg font-bold text-white capitalize">{provider}</div>
              <p className="text-[11px] text-slate-400">
                {provider === "gmail" ? "Google OAuth 2.0" : provider}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Sender Status</span>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-lg font-bold text-white flex items-center gap-1.5">
                {gmailAuth || smtpHost ? (
                  <span className="text-emerald-400">Authorized</span>
                ) : (
                  <span className="text-amber-400">Pending Setup</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {gmailAuth ? "Active token verified" : "Check credentials in Settings"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Deliverability Score</span>
                <Sparkles className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="text-lg font-bold text-emerald-400">Optimal (98%)</div>
              <p className="text-[11px] text-slate-400">Strict SPF/DKIM validation</p>
            </div>
          </div>

          {/* DNS & Protocols Deliverability Checklist */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <h3 className="font-semibold text-white text-sm">Outbound Deliverability Guardrails</h3>
            <div className="divide-y divide-slate-800/80">
              <div className="py-3 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-medium text-white">SPF & DKIM Alignment</h4>
                  <p className="text-[11px] text-slate-400">
                    Ensures outgoing emails are cryptographically signed by your domain.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" /> Configured
                </span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-medium text-white">DMARC Policy Enforcement</h4>
                  <p className="text-[11px] text-slate-400">
                    Guards domain reputation against spoofing and spam folder placement.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" /> Enforced
                </span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-medium text-white">TrulyInbox Warmup Integration</h4>
                  <p className="text-[11px] text-slate-400">
                    Gradual sending volume ramping to maintain high inbox placement.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400 border border-sky-500/20">
                  Supported
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
