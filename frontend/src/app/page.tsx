"use client";

import React from "react";
import Link from "next/link";
import { useToday } from "@/hooks/use-today";
import { useOutreachStatus } from "@/hooks/use-outreach-status";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import {
  Sparkles,
  Building2,
  Users,
  Send,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Play,
  Square,
  Search,
  ExternalLink,
  Flame,
  CalendarCheck,
  TrendingUp,
} from "lucide-react";

export default function TodayPage() {
  const { data, isLoading } = useToday();
  const { isRunning, startOutreach, stopOutreach, isStarting, isStopping } = useOutreachStatus();

  // Fetch pipeline funnel breakdown
  const { data: statsData } = useQuery<any>({
    queryKey: ["pipeline-stats"],
    queryFn: () => fetchApi("/api/stats"),
    refetchInterval: 5000,
  });

  const stats = data?.stats;
  const items = data?.items || [];
  const pipeline = statsData?.pipeline || {};

  const funnelStages = [
    { key: "to_write", label: "To Write", count: pipeline.to_write || 0, color: "bg-slate-700 text-slate-300" },
    { key: "contacted", label: "Contacted", count: pipeline.contacted || 0, color: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
    { key: "replied", label: "Replied", count: pipeline.replied || 0, color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
    { key: "interested", label: "Interested", count: pipeline.interested || 0, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    { key: "ready_to_meet", label: "Meeting Ready", count: pipeline.ready_to_meet || 0, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Today's Pipeline</h1>
            <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 ring-1 ring-sky-500/20">
              Live Engine
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Real-time status of what needs your review and how autonomous outreach is progressing.
          </p>
        </div>

        {/* Quick Engine Action Button */}
        <div className="flex items-center gap-3">
          {isRunning ? (
            <button
              onClick={() => stopOutreach()}
              disabled={isStopping}
              className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
            >
              <Square className="h-3.5 w-3.5 fill-rose-400" />
              <span>{isStopping ? "Pausing..." : "Pause Outbound"}</span>
            </button>
          ) : (
            <button
              onClick={() => startOutreach()}
              disabled={isStarting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/25 hover:opacity-95 transition cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-white" />
              <span>{isStarting ? "Starting..." : "Start Outbound"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Needs Attention / Human Review Banner Queue */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Action Items & Human Review
        </h2>

        {items.length === 0 ? (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-emerald-300">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">All clear — no blocking items</p>
                <p className="text-xs text-emerald-400/80">
                  Outreach is operating smoothly with 0 manual interventions required right now.
                </p>
              </div>
            </div>
            <Link
              href="/outbox"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              <span>View Outbox</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item, idx) => {
              const isBad = item.tone === "bad";
              const isWarn = item.tone === "warn";

              return (
                <div
                  key={idx}
                  className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between transition ${
                    isBad
                      ? "border-rose-500/30 bg-rose-950/20 text-rose-200"
                      : isWarn
                      ? "border-amber-500/30 bg-amber-950/20 text-amber-200"
                      : "border-sky-500/30 bg-sky-950/20 text-sky-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        isBad
                          ? "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30"
                          : isWarn
                          ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                          : "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30"
                      }`}
                    >
                      {isBad ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                      <p className="mt-0.5 text-xs opacity-90 leading-relaxed">{item.detail}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 sm:self-center">
                    {item.tab && (
                      <Link
                        href={`/${item.tab === "today" ? "" : item.tab}`}
                        className="flex items-center gap-1 rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition"
                      >
                        <span>{item.action || "Resolve"}</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition"
                      >
                        <span>{item.url_label || "Open"}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Companies */}
        <Link
          href="/companies"
          className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700 hover:bg-slate-900 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Target Companies</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 group-hover:scale-105 transition-transform">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">
              {stats ? formatNumber(stats.companies) : "—"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {stats?.unprofiled ? `${stats.unprofiled} awaiting profile` : "All profiled & enriched"}
          </p>
        </Link>

        {/* Prospects */}
        <Link
          href="/decision-makers"
          className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700 hover:bg-slate-900 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Decision-Makers</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">
              {stats ? formatNumber(stats.prospects) : "—"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {stats?.signals_confirmed ?? 0} confirmed buying signals
          </p>
        </Link>

        {/* Outbox Pending */}
        <Link
          href="/outbox"
          className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700 hover:bg-slate-900 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Outbox Queue</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">
              {stats ? formatNumber(stats.outbox_pending) : "—"}
            </span>
            <span className="text-xs text-amber-400 font-medium">pending review</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {stats?.outbox_approved ?? 0} approved for dispatch
          </p>
        </Link>

        {/* Active Conversations */}
        <Link
          href="/conversations"
          className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700 hover:bg-slate-900 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Conversations</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">
              {stats ? formatNumber(stats.open_conversations) : "—"}
            </span>
            <span className="text-xs text-emerald-400 font-medium">open replies</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {stats?.needs_human ? `${stats.needs_human} waiting on you` : "0 waiting on human"}
          </p>
        </Link>
      </div>

      {/* Funnel Progression Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-sky-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Pipeline Stage Progression
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            End-to-End Account Conversion
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {funnelStages.map((stage) => (
            <div
              key={stage.key}
              className={`rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 flex flex-col justify-between`}
            >
              <span className="text-[11px] font-medium text-slate-400">{stage.label}</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold text-white">{stage.count}</span>
                <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 border ${stage.color}`}>
                  {stage.count > 0 ? "Active" : "Idle"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Launchpad & Workflows */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Autonomous Agent Launchpad
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/discovery"
            className="flex items-center gap-3.5 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 hover:border-sky-500/40 hover:bg-slate-800/80 transition group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 group-hover:scale-105 transition-transform">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">ICP Discovery</p>
              <p className="text-[11px] text-slate-400">Find new accounts matching your profile</p>
            </div>
          </Link>

          <Link
            href="/discovery/enrich"
            className="flex items-center gap-3.5 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 hover:border-indigo-500/40 hover:bg-slate-800/80 transition group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 group-hover:scale-105 transition-transform">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">URL Enrichment</p>
              <p className="text-[11px] text-slate-400">Scan domains & extract decision-makers</p>
            </div>
          </Link>

          <Link
            href="/decision-makers"
            className="flex items-center gap-3.5 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 hover:border-emerald-500/40 hover:bg-slate-800/80 transition group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 group-hover:scale-105 transition-transform">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Decision-Makers</p>
              <p className="text-[11px] text-slate-400">Review verified leads & generate pitches</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
