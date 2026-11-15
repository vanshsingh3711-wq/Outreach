"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { Activity, Clock, Shield, CheckCircle2, User, Send, Sparkles, Loader2 } from "lucide-react";

export default function ActivityPage() {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["activity-log"],
    queryFn: () => fetchApi<any[]>("/api/activity"),
    refetchInterval: 5000,
  });

  const activities = data || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">System Activity & Audit Log</h1>
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300 border border-slate-700">
            {activities.length} Recorded Events
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Chronological record of automated agent operations, draft approvals, outbound dispatches, and decisions.
        </p>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky-400 mb-2" />
          <span>Loading activity log...</span>
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center text-slate-500">
          No system actions logged yet. Agent operations will record here automatically.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm">
          <div className="space-y-4">
            {activities.map((act) => {
              const actionType = act.action_type || act.action || "action";
              const isSend = actionType.includes("send");
              const isApprove = actionType.includes("approve");
              const isDiscover = actionType.includes("discover") || actionType.includes("profile");

              return (
                <div
                  key={act.id || act.created_at}
                  className="flex items-start gap-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 transition hover:border-slate-700"
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                      isSend
                        ? "bg-emerald-500/15 text-emerald-400"
                        : isApprove
                        ? "bg-sky-500/15 text-sky-400"
                        : isDiscover
                        ? "bg-indigo-500/15 text-indigo-400"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {isSend ? (
                      <Send className="h-4 w-4" />
                    ) : isApprove ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-xs uppercase tracking-wider">
                        {actionType.replace(/_/g, " ")}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {act.created_at || "Recent"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">
                      Actor: <span className="font-medium text-slate-200">{act.actor || "autonomous_agent"}</span>
                    </p>

                    {act.details && Object.keys(act.details).length > 0 && (
                      <div className="mt-2 rounded-lg bg-slate-900/80 p-2 font-mono text-[11px] text-slate-400 overflow-x-auto">
                        {JSON.stringify(act.details)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
