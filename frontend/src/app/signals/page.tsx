"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Tabs,
  Skeleton,
} from "@/components/ui";
import {
  Radio,
  CheckCircle2,
  Compass,
  FileText,
  Users,
  ShieldCheck,
  Search,
  Zap,
} from "lucide-react";
import Link from "next/link";

interface Signal {
  code: string;
  label: string;
  description: string;
  category: string;
  value_type: string;
  collector: string;
  cost_note: string;
  status: string;
  observations?: number;
  companies?: number;
}

interface SignalGroup {
  key: string;
  label: string;
  blurb: string;
  signals: Signal[];
}

interface SignalsResponse {
  summary: {
    proposed: number;
    confirmed: number;
    rejected: number;
  };
  groups: SignalGroup[];
  total: number;
}

export default function SignalsPage() {
  const [activeGroupKey, setActiveGroupKey] = useState<string>("all");

  const { data, isLoading } = useQuery<SignalsResponse>({
    queryKey: ["signals-catalog"],
    queryFn: () => fetchApi<SignalsResponse>("/api/signals"),
  });

  const summary = data?.summary || { proposed: 0, confirmed: 0, rejected: 0 };
  const groups = data?.groups || [];

  const tabItems = [
    { id: "all", label: "All Signals", badge: data?.total ?? 0 },
    ...groups.map((g) => ({
      id: g.key,
      label: g.label.split("—")[0].trim(),
      badge: g.signals.length,
    })),
  ];

  const displayedGroups =
    activeGroupKey === "all"
      ? groups
      : groups.filter((g) => g.key === activeGroupKey);

  const getCategoryIcon = (key: string) => {
    switch (key) {
      case "discovery":
        return <Compass className="h-4 w-4" />;
      case "profile":
        return <FileText className="h-4 w-4" />;
      case "people":
        return <Users className="h-4 w-4" />;
      case "verification":
        return <ShieldCheck className="h-4 w-4" />;
      default:
        return <Radio className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Buying Signals & Triggers
            </h1>
            <Badge variant="info" size="sm" dot>
              {data?.total ?? 29} Active Signals
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Signals that Scout continuously monitors to personalize outreach and trigger outbound sequences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/discovery">
            <Button variant="outline" size="sm" leftIcon={<Search className="h-3.5 w-3.5" />}>
              Discover by Signals
            </Button>
          </Link>
        </div>
      </div>

      {/* Signal Categories Tabs */}
      <div className="border-b border-border pb-3">
        <Tabs
          items={tabItems}
          value={activeGroupKey}
          onChange={setActiveGroupKey}
          variant="pill"
        />
      </div>

      {/* Groups Display */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {displayedGroups.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs tracking-tight">
                <span className="text-muted-foreground">{getCategoryIcon(group.key)}</span>
                <h3>{group.label}</h3>
                <span className="text-muted-foreground font-normal">({group.signals.length})</span>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">{group.blurb}</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.signals.map((sig) => (
                  <Card key={sig.code} className="p-4 space-y-2.5 hover:border-border/80 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-foreground truncate">{sig.label}</h4>
                      <Badge variant="neutral" size="sm" className="font-mono text-[9px] uppercase">
                        {sig.value_type}
                      </Badge>
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                      {sig.description}
                    </p>

                    <div className="flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground font-mono">
                      <span>Collector: {sig.collector}</span>
                      <span className="text-foreground/80">{sig.cost_note}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
