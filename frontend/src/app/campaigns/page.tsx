"use client";

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
} from "@/components/ui";
import { Layers, Send, Clock, MessageSquare, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function CampaignsPage() {
  const cadenceSteps = [
    {
      step: 1,
      title: "Initial Personalized Angle",
      timing: "Day 0",
      description: "Custom value hook referencing target tech stack, hiring signals, or company pains.",
      badge: "Touch 1",
    },
    {
      step: 2,
      title: "Contextual Follow-up & Case Proof",
      timing: "Day 3 (+72h)",
      description: "Brief 3-sentence bump sharing concrete outcome metrics or quick loom audit.",
      badge: "Touch 2",
    },
    {
      step: 3,
      title: "Graceful Breakaway / Final Check-in",
      timing: "Day 7 (+96h)",
      description: "Zero-pressure breakaway giving the prospect a quick out or permission to defer.",
      badge: "Touch 3",
    },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Campaign Cadence & Sequences
            </h1>
            <Badge variant="default" size="sm">
              3-Step Multi-Touch
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Automated spacing, objection handling, and sequence progression across target prospects.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/outbox">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
              Review Outbox Queue
            </Button>
          </Link>
        </div>
      </div>

      {/* Cadence Sequence Steps Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span>Outreach Cadence Architecture</span>
          </CardTitle>
          <CardDescription>
            Prospect cohorts follow an automated 3-step sequence with automatic cutoff upon reply.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {cadenceSteps.map((s) => (
              <div
                key={s.step}
                className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase font-semibold">
                      {s.timing}
                    </span>
                    <Badge variant="neutral" size="sm" className="font-mono text-[9px]">
                      {s.badge}
                    </Badge>
                  </div>
                  <h4 className="mt-2 text-xs font-semibold text-foreground">{s.title}</h4>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    {s.description}
                  </p>
                </div>

                <div className="border-t border-border/50 pt-2 flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Auto-pauses on reply</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
