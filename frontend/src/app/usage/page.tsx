"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { formatNumber, formatTokens } from "@/lib/utils";
import {
  MetricCard,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Skeleton,
} from "@/components/ui";
import { BarChart3, Cpu, DollarSign, Activity, Sparkles, Layers } from "lucide-react";

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
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              AI Usage & Cost Telemetry
            </h1>
            <Badge variant="success" size="sm" dot>
              {data?.provider || "DeepSeek API"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Monitor model token throughput, prompt/completion ratios, and operational LLM expenses.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-4">
        <MetricCard
          title="Tokens Today"
          value={formatTokens(todayTokens)}
          icon={<Sparkles className="h-4 w-4" />}
          subtitle={`In: ${formatTokens(today.input_tokens || 0)} · Out: ${formatTokens(today.output_tokens || 0)}`}
        />

        <MetricCard
          title="Tokens (30 Days)"
          value={formatTokens(monthTokens)}
          icon={<BarChart3 className="h-4 w-4" />}
          subtitle={`Across ${formatNumber(month.calls || 0)} model inferences`}
        />

        <MetricCard
          title="API Inferences Today"
          value={formatNumber(todayCalls)}
          icon={<Activity className="h-4 w-4" />}
          subtitle="Direct HTTP calls to DeepSeek"
        />

        <MetricCard
          title="Est. Cost (30 Days)"
          value={`$${monthCost.toFixed(3)}`}
          icon={<DollarSign className="h-4 w-4" />}
          subtitle="Optimized deepseek-chat pricing"
          trend={{ value: "Low Cost", isPositive: true }}
        />
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* By Agent Routine */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <span>Usage by Agent Routine</span>
            </CardTitle>
            <CardDescription>
              Breakdown of token consumption across Scout, Writer, and Dispatcher agents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : byAgent.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No agent telemetry recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Inferences</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byAgent.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold capitalize text-xs">
                        {item.agent || "Scout / Brain"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {formatNumber(item.calls || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground font-medium">
                        {formatTokens(item.total_tokens || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* By Task Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span>Usage by Task Type</span>
            </CardTitle>
            <CardDescription>
              Model workload distribution between discovery, research, and personalization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : byTask.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No task telemetry recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task Type</TableHead>
                    <TableHead className="text-right">Inferences</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byTask.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold capitalize text-xs">
                        {item.task || "Outreach Pitch"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {formatNumber(item.calls || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground font-medium">
                        ${((item.cost_usd || 0) as number).toFixed(3)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
