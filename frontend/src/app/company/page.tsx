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
  Button,
  Skeleton,
} from "@/components/ui";
import { Building2, Sparkles, ArrowRight, Settings } from "lucide-react";
import Link from "next/link";

export default function CompanyProfilePage() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["company-config"],
    queryFn: () => fetchApi("/api/company"),
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Your Company & Value Proposition
            </h1>
            <Badge variant="default" size="sm">
              Persona & ICP
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Everything DeepSeek writes from: what you sell, who you sell to, and your core call to action.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/settings">
            <Button variant="outline" size="sm" leftIcon={<Settings className="h-3.5 w-3.5" />}>
              System Settings
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* What you sell */}
          <Card>
            <CardHeader>
              <CardTitle>What You Sell</CardTitle>
              <CardDescription>
                The primary product or service pitched in personalized outbound messages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-muted/20 p-4 font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap select-text">
                {data?.product || data?.what_you_sell || "Outreach — Autonomous AI B2B Outbound Engine"}
              </div>
            </CardContent>
          </Card>

          {/* Target Audience / ICP */}
          <Card>
            <CardHeader>
              <CardTitle>Ideal Customer Profile (ICP)</CardTitle>
              <CardDescription>
                Target organization sizes, technical stacks, locations, and decision-maker roles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-muted/20 p-4 font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap select-text">
                {data?.icp || data?.who_you_sell_to || "Founders, VP Engineering, CTOs, and Heads of Sales"}
              </div>
            </CardContent>
          </Card>

          {/* The Offer */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Core Offer & Call to Action (CTA)</CardTitle>
              <CardDescription>
                The low-friction hook closing cold emails (e.g. quick walkthrough, loom demo, audit).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-muted/20 p-4 font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap select-text">
                {data?.offer || data?.the_offer || "A 15-minute quick walkthrough of the autonomous agent pipeline."}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
