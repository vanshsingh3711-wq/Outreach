"use client";

import React from "react";
import Link from "next/link";
import { useToday } from "@/hooks/use-today";
import { useOutreachStatus } from "@/hooks/use-outreach-status";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import {
  MetricCard,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatusDot,
  Skeleton,
} from "@/components/ui";
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
  TrendingUp,
  Compass,
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
    { key: "to_write", label: "To Write", count: pipeline.to_write || 0 },
    { key: "contacted", label: "Contacted", count: pipeline.contacted || 0 },
    { key: "replied", label: "Replied", count: pipeline.replied || 0 },
    { key: "interested", label: "Interested", count: pipeline.interested || 0 },
    { key: "ready_to_meet", label: "Meeting Ready", count: pipeline.ready_to_meet || 0 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Mission Control
            </h1>
            <Badge variant={isRunning ? "success" : "neutral"} size="sm" dot pulseDot={isRunning}>
              {isRunning ? "Autonomous Engine Active" : "Standby"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Real-time pipeline metrics, items requiring review, and autonomous outbound velocity.
          </p>
        </div>

        {/* Quick Engine Action Button */}
        <div className="flex items-center gap-2.5">
          {isRunning ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => stopOutreach()}
              disabled={isStopping}
              isLoading={isStopping}
              leftIcon={<Square className="h-3 w-3 fill-current" />}
            >
              <span>Pause Outbound</span>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => startOutreach()}
              disabled={isStarting}
              isLoading={isStarting}
              leftIcon={<Play className="h-3 w-3 fill-current" />}
            >
              <span>Start Outbound</span>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Outbox Queue */}
        <Link href="/outbox" className="block group">
          <MetricCard
            title="Outbox Review Queue"
            value={stats ? formatNumber(stats.outbox_pending) : "—"}
            icon={<Send className="h-4 w-4" />}
            subtitle={
              stats?.outbox_approved ? `${stats.outbox_approved} approved for dispatch` : "No approved items waiting"
            }
            trend={
              stats?.outbox_pending && stats.outbox_pending > 0
                ? { value: `${stats.outbox_pending} pending`, neutral: false, isPositive: false }
                : { value: "All cleared", neutral: true }
            }
            className="group-hover:border-border/80 group-hover:bg-card/80"
          />
        </Link>

        {/* Inbound Conversations */}
        <Link href="/conversations" className="block group">
          <MetricCard
            title="Open Conversations"
            value={stats ? formatNumber(stats.open_conversations) : "—"}
            icon={<MessageSquare className="h-4 w-4" />}
            subtitle={
              stats?.needs_human
                ? `${stats.needs_human} replies waiting on your input`
                : "0 threads waiting on human"
            }
            trend={
              stats?.needs_human && stats.needs_human > 0
                ? { value: `${stats.needs_human} needs human`, neutral: false, isPositive: false }
                : { value: "Up to date", neutral: true }
            }
            className="group-hover:border-border/80 group-hover:bg-card/80"
          />
        </Link>

        {/* Target Companies */}
        <Link href="/companies" className="block group">
          <MetricCard
            title="Target Accounts"
            value={stats ? formatNumber(stats.companies) : "—"}
            icon={<Building2 className="h-4 w-4" />}
            subtitle={
              stats?.unprofiled ? `${stats.unprofiled} awaiting profile` : "All accounts profiled & enriched"
            }
            className="group-hover:border-border/80 group-hover:bg-card/80"
          />
        </Link>

        {/* Decision-Makers */}
        <Link href="/decision-makers" className="block group">
          <MetricCard
            title="Decision-Makers"
            value={stats ? formatNumber(stats.prospects) : "—"}
            icon={<Users className="h-4 w-4" />}
            subtitle={`${stats?.signals_confirmed ?? 0} confirmed buying signals`}
            className="group-hover:border-border/80 group-hover:bg-card/80"
          />
        </Link>
      </div>

      {/* Action Items & Triage Queue (Inbox Zero Style) */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <div className="space-y-0.5">
            <CardTitle className="flex items-center gap-2">
              <span>Action Items & Human Review</span>
              {items.length > 0 && (
                <Badge variant="warning" size="sm" className="font-mono">
                  {items.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Tasks and outbound emails requiring your authorization or input.
            </CardDescription>
          </div>
          {items.length > 0 && (
            <Link href="/outbox">
              <Button variant="ghost" size="xs" rightIcon={<ArrowRight className="h-3 w-3" />}>
                Review All
              </Button>
            </Link>
          )}
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-600 dark:text-emerald-400">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">All systems clear — Inbox zero</p>
                  <p className="text-[11px] text-muted-foreground">
                    Outreach is operating smoothly with 0 manual interventions required right now.
                  </p>
                </div>
              </div>
              <Link href="/outbox">
                <Button variant="outline" size="xs" rightIcon={<ArrowRight className="h-3 w-3" />}>
                  Inspect Outbox
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {items.map((item, idx) => {
                const isBad = item.tone === "bad";
                const isWarn = item.tone === "warn";

                return (
                  <div
                    key={idx}
                    className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          isBad
                            ? "bg-rose-500/10 text-rose-500"
                            : isWarn
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-sky-500/10 text-sky-500"
                        }`}
                      >
                        {isBad ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-foreground">{item.title}</h4>
                          <Badge
                            variant={isBad ? "destructive" : isWarn ? "warning" : "info"}
                            size="sm"
                          >
                            {isBad ? "Urgent" : isWarn ? "Review" : "Info"}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                          {item.detail}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:self-center">
                      {item.tab && (
                        <Link href={`/${item.tab === "today" ? "" : item.tab}`}>
                          <Button variant="outline" size="xs" rightIcon={<ArrowRight className="h-3 w-3" />}>
                            {item.action || "Resolve"}
                          </Button>
                        </Link>
                      )}
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="xs" rightIcon={<ExternalLink className="h-3 w-3" />}>
                            {item.url_label || "Open"}
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Stage Progression Strip */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <div className="space-y-0.5">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span>Pipeline Stage Progression</span>
            </CardTitle>
            <CardDescription>
              End-to-end conversion funnel across targeted prospect accounts.
            </CardDescription>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            Total in cycle: {Object.values(pipeline).reduce((a: any, b: any) => (Number(a) || 0) + (Number(b) || 0), 0) as number}
          </span>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {funnelStages.map((stage) => (
              <div
                key={stage.key}
                className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col justify-between"
              >
                <span className="text-[11px] font-medium text-muted-foreground">{stage.label}</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl font-semibold tracking-tight text-foreground font-mono tabular-nums">
                    {stage.count}
                  </span>
                  <Badge
                    variant={stage.count > 0 ? "default" : "neutral"}
                    size="sm"
                    className="text-[10px]"
                  >
                    {stage.count > 0 ? "Active" : "Idle"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Autonomous Agent Quick Workflows */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/discovery"
          className="group rounded-xl border border-border bg-card p-4 hover:border-border/80 hover:bg-card/80 transition shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
              <Compass className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">ICP Discovery</p>
              <p className="text-[11px] text-muted-foreground">Find new accounts matching your profile</p>
            </div>
          </div>
        </Link>

        <Link
          href="/discovery/enrich"
          className="group rounded-xl border border-border bg-card p-4 hover:border-border/80 hover:bg-card/80 transition shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
              <Search className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">URL Enrichment</p>
              <p className="text-[11px] text-muted-foreground">Scan domains & extract decision-makers</p>
            </div>
          </div>
        </Link>

        <Link
          href="/decision-makers"
          className="group rounded-xl border border-border bg-card p-4 hover:border-border/80 hover:bg-card/80 transition shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
              <Users className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Decision-Makers</p>
              <p className="text-[11px] text-muted-foreground">Review leads & generate AI pitches</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
