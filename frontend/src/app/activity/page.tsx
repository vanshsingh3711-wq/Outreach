"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Skeleton,
} from "@/components/ui";
import { Activity, CheckCircle2, Send, Sparkles, AlertCircle } from "lucide-react";

export default function ActivityPage() {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["activity-log"],
    queryFn: () => fetchApi<any[]>("/api/activity"),
    refetchInterval: 5000,
  });

  const activities = data || [];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              System Activity & Audit Log
            </h1>
            <Badge variant="neutral" size="sm" className="font-mono">
              {activities.length} Recorded Events
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Chronological audit trail of autonomous agent tasks, draft approvals, outbound dispatches, and sentiment events.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : activities.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-3">
            <Activity className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No system events logged yet</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            As autonomous operations run, their timestamped actions and decisions will stream here.
          </p>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 divide-y divide-border/60">
            {activities.map((act) => {
              const actionType = act.action_type || act.action || "action";
              const isSend = actionType.includes("send");
              const isApprove = actionType.includes("approve");
              const isDiscover = actionType.includes("discover") || actionType.includes("profile");

              return (
                <div
                  key={act.id || act.created_at}
                  className="flex items-start gap-3.5 py-3 first:pt-1 last:pb-1"
                >
                  <div
                    className={`mt-0.5 flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg ${
                      isSend
                        ? "bg-emerald-500/10 text-emerald-500"
                        : isApprove
                        ? "bg-sky-500/10 text-sky-500"
                        : isDiscover
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isSend ? (
                      <Send className="h-3.5 w-3.5" />
                    ) : isApprove ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </div>

                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-xs uppercase tracking-wider">
                        {actionType.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {act.created_at || "Recent"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {act.detail || act.notes || act.message || "Agent routine executed successfully."}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
