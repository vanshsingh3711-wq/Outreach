"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { formatNumber, formatTokens } from "@/lib/utils";
import { BarChart3, Cpu, DollarSign, Activity, Layers, Sparkles } from "lucide-react";

export default function UsagePage() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["usage-stats"],
    queryFn: () => fetchApi("/api/usage"),
    refetchInterval: 10000,
  });

  const today = data?.totals?.today || {};
  const month = data?.totals?.month || {};
  const byAgent = data?.by_agent || [];
  const byTask = data?.by_task || [];

  const todayTokens = (today.input_tokens || 0) + (today.output_tokens || 0);
  const monthTokens = (month.input_tokens || 0) + (month.output_tokens || 0);
  const todayCalls = today.calls || 0;
  const monthCost = month.cost_usd || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">AI Usage & Cost Telemetry</h1>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            {data?.provider || "DeepSeek"}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Monitor token consumption, prompt/completion ratios, and operational costs across all agent routines.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Tokens Today</span>
            <Sparkles className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {formatTokens(todayTokens)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            In: {formatTokens(today.input_tokens || 0)} · Out: {formatTokens(today.output_tokens || 0)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Tokens (30 Days)</span>
            <BarChart3 className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {formatTokens(monthTokens)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Across {formatNumber(month.calls || 0)} model inferences
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>API Calls Today</span>
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {formatNumber(todayCalls)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Direct HTTP calls to DeepSeek</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Est. Cost (30 Days)</span>
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            ${monthCost.toFixed(3)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">High efficiency deepseek-chat pricing</p>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Breakdown by Agent */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-sky-400" />
            <h3 className="font-semibold text-white text-sm">Usage by Agent (30 Days)</h3>
          </div>

          <div className="space-y-3">
            {byAgent.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">No agent usage recorded yet.</p>
            ) : (
              byAgent.map((agent: any, idx: number) => {
                const total = (agent.input_tokens || 0) + (agent.output_tokens || 0);
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 p-3"
                  >
                    <div>
                      <span className="font-semibold text-white text-xs uppercase tracking-wider">
                        {agent.agent || "Core"}
                      </span>
                      <p className="text-[11px] text-slate-400">
                        {agent.calls || 0} calls · ${(agent.cost_usd || 0).toFixed(4)}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-medium text-sky-400">
                      {formatTokens(total)} tok
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Breakdown by Task */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-400" />
            <h3 className="font-semibold text-white text-sm">Usage by Task (30 Days)</h3>
          </div>

          <div className="space-y-3">
            {byTask.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">No task usage recorded yet.</p>
            ) : (
              byTask.map((task: any, idx: number) => {
                const total = (task.input_tokens || 0) + (task.output_tokens || 0);
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 p-3"
                  >
                    <div>
                      <span className="font-medium text-slate-200 text-xs">
                        {task.task || "routine"}
                      </span>
                      <p className="text-[11px] text-slate-400">
                        {task.calls || 0} executions
                      </p>
                    </div>
                    <span className="font-mono text-xs font-medium text-indigo-400">
                      {formatTokens(total)} tok
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

