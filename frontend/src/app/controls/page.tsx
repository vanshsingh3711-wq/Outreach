"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOutreachStatus } from "@/hooks/use-outreach-status";
import { fetchApi } from "@/lib/api-client";
import {
  MetricCard,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  StatusDot,
} from "@/components/ui";
import {
  Terminal,
  Play,
  Square,
  Search,
  Copy,
  Check,
  Download,
  Trash2,
  Cpu,
  Layers,
  ArrowDownCircle,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ControlsPage() {
  const { isRunning, pid, startOutreach, stopOutreach, isStarting, isStopping, aiStatus } =
    useOutreachStatus();

  const [logFilter, setLogFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "error" | "brain" | "dispatch">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [cleared, setCleared] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Live status query for agent steps and next actions
  const { data: liveStatusData } = useQuery<any>({
    queryKey: ["live-status"],
    queryFn: () => fetchApi("/api/live-status"),
    refetchInterval: 3000,
  });

  // Logs stream query
  const { data: logsData } = useQuery<{ lines: string[] }>({
    queryKey: ["outreach-logs"],
    queryFn: () => fetchApi<{ lines: string[] }>("/api/outreach/logs"),
    refetchInterval: 1500,
  });

  const rawLines = cleared ? [] : logsData?.lines || [];

  // Filter lines by level and text
  const filteredLines = rawLines.filter((line) => {
    if (logFilter && !line.toLowerCase().includes(logFilter.toLowerCase())) {
      return false;
    }

    if (levelFilter === "error") {
      return /error|fail|exception|fatal|traceback|reject/i.test(line);
    }
    if (levelFilter === "brain") {
      return /brain|deepseek|think|model|writer|prompt/i.test(line);
    }
    if (levelFilter === "dispatch") {
      return /send|dispatch|outbox|email|sent/i.test(line);
    }

    return true;
  });

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [filteredLines, autoScroll]);

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(filteredLines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const blob = new Blob([filteredLines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `outreach-log-${new Date().toISOString().slice(0, 19)}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Agent Console & Live Logs
            </h1>
            <Badge variant={isRunning ? "success" : "neutral"} size="sm" dot pulseDot={isRunning}>
              {isRunning ? "Autonomous Engine Active" : "Standby Mode"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Direct telemetry stream of autonomous agent tasks, reasoning chains, and dispatch execution.
          </p>
        </div>

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
              <span>Pause Process</span>
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
              <span>Start Process</span>
            </Button>
          )}
        </div>
      </div>

      {/* Process KPI Strip */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-4">
        <MetricCard
          title="Engine Status"
          value={isRunning ? "Online" : "Standby"}
          icon={<Activity className="h-4 w-4" />}
          subtitle={isRunning ? `Process PID: ${pid}` : "Awaiting start signal"}
          trend={isRunning ? { value: "Live Heartbeat", isPositive: true } : undefined}
        />

        <MetricCard
          title="Active Step / Task"
          value={liveStatusData?.step || (isRunning ? "Scanning ICP" : "Idle")}
          icon={<Layers className="h-4 w-4" />}
          subtitle={liveStatusData?.company ? `Account: ${liveStatusData.company}` : "Autonomous loop"}
        />

        <MetricCard
          title="AI Intelligence Model"
          value="DeepSeek"
          icon={<Cpu className="h-4 w-4" />}
          subtitle={aiStatus?.model ? `Model: ${aiStatus.model}` : "deepseek-chat v3"}
        />

        <MetricCard
          title="Telemetry Buffer"
          value={`${rawLines.length} lines`}
          icon={<Terminal className="h-4 w-4" />}
          subtitle={`${filteredLines.length} filtered lines shown`}
        />
      </div>

      {/* Terminal Console Card */}
      <Card className="overflow-hidden border border-border">
        {/* Terminal Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 p-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1">
            {(["all", "brain", "dispatch", "error"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium uppercase transition cursor-pointer select-none",
                  levelFilter === lvl
                    ? "bg-card text-foreground font-semibold shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {lvl === "all" ? "All Output" : lvl}
              </button>
            ))}
          </div>

          {/* Search, Autoscroll & Actions */}
          <div className="flex items-center gap-2">
            <Input
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              placeholder="Search terminal lines..."
              leftIcon={<Search className="h-3 w-3" />}
              className="h-7.5 w-48 text-[11px]"
            />

            <Button
              variant={autoScroll ? "secondary" : "outline"}
              size="xs"
              onClick={() => setAutoScroll(!autoScroll)}
              title="Toggle autoscroll"
            >
              <ArrowDownCircle className={cn("h-3 w-3 mr-1", autoScroll && "text-emerald-500")} />
              <span>Scroll</span>
            </Button>

            <Button
              variant="outline"
              size="xs"
              onClick={handleCopyLogs}
              title="Copy output to clipboard"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </Button>

            <Button
              variant="outline"
              size="xs"
              onClick={handleDownloadLogs}
              title="Download log file"
            >
              <Download className="h-3 w-3" />
            </Button>

            <Button
              variant="ghost"
              size="xs"
              onClick={() => setCleared(true)}
              title="Clear terminal buffer"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Monospaced Log Output Stage */}
        <div
          ref={terminalRef}
          className="h-[520px] overflow-y-auto bg-[#09090b] p-4 font-mono text-[11px] leading-relaxed select-text"
        >
          {filteredLines.length === 0 ? (
            <div className="py-20 text-center text-zinc-600">
              {cleared ? "Terminal buffer cleared." : "Awaiting agent execution logs..."}
            </div>
          ) : (
            filteredLines.map((line, idx) => {
              const isError = /error|fail|exception|fatal|traceback|reject/i.test(line);
              const isBrain = /brain|deepseek|think|writer|prompt/i.test(line);
              const isDispatch = /send|dispatch|outbox|email|sent/i.test(line);

              return (
                <div
                  key={idx}
                  className={cn(
                    "py-0.5 px-1 rounded hover:bg-zinc-900/60 transition-colors",
                    isError
                      ? "text-rose-400 bg-rose-950/20"
                      : isBrain
                      ? "text-sky-300"
                      : isDispatch
                      ? "text-emerald-300"
                      : "text-zinc-400"
                  )}
                >
                  <span className="text-zinc-600 select-none mr-2 font-mono text-[10px]">
                    {String(idx + 1).padStart(4, "0")}
                  </span>
                  <span>{line}</span>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
