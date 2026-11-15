"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { Settings, Shield, Mail, CheckCircle2, XCircle, Key, Cpu, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["settings-data"],
    queryFn: () => fetchApi("/api/settings"),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">System Settings & Integrations</h1>
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300 border border-slate-700">
            Environment
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Verification of API credentials, outbound email dispatchers, and AI provider configurations.
        </p>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky-400 mb-2" />
          <span>Loading system settings...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* AI Intelligence Engine */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-sky-400" />
              <h3 className="font-semibold text-white text-sm">AI Engine Core</h3>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Active Provider</span>
                <span className="font-semibold text-white">DeepSeek API</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Chat Model</span>
                <span className="font-mono text-sky-400">deepseek-chat</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Connection Mode</span>
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  Direct Native
                </span>
              </div>
            </div>
          </div>

          {/* Email Delivery Provider */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-indigo-400" />
              <h3 className="font-semibold text-white text-sm">Outbound Mailbox</h3>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Configured Dispatcher</span>
                <span className="font-semibold text-white capitalize">
                  {data?.provider || "Local / Gmail / SMTP"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Gmail OAuth</span>
                <span className="flex items-center gap-1 font-medium text-xs">
                  {data?.gmail_authorized ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Authorized
                    </span>
                  ) : (
                    <span className="text-slate-500">Not configured</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">SMTP Host</span>
                <span className="font-mono text-xs text-slate-300">
                  {data?.smtp_host || "localhost"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

