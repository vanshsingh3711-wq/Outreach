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
import {
  Settings,
  Shield,
  Mail,
  CheckCircle2,
  XCircle,
  Key,
  Cpu,
  Building2,
  ArrowRight,
  Terminal,
} from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["settings-data"],
    queryFn: () => fetchApi("/api/settings"),
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Settings & Integrations
            </h1>
            <Badge variant="neutral" size="sm">
              System Environment
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Configuration of AI intelligence models, outbound mailbox dispatchers, and company value proposition.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/company">
            <Button variant="outline" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
              Edit Company & ICP
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* AI Intelligence Engine */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <span>AI Engine Core</span>
              </CardTitle>
              <CardDescription>
                Primary LLM provider powering discovery reasoning and cold email drafting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active Provider</span>
                  <span className="font-semibold text-foreground">DeepSeek API</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Chat Model</span>
                  <span className="font-mono text-primary font-medium">deepseek-chat</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Integration Mode</span>
                  <Badge variant="success" size="sm" dot>
                    Direct Native HTTP
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Delivery Provider */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span>Outbound Mailbox</span>
              </CardTitle>
              <CardDescription>
                Authenticated dispatcher used to send personalized sequence emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Configured Dispatcher</span>
                  <span className="font-semibold text-foreground capitalize">
                    {data?.provider || "Local / Gmail / SMTP"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Gmail OAuth</span>
                  {data?.gmail_authorized ? (
                    <Badge variant="success" size="sm" dot>
                      Authorized
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground italic">Not connected</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">SMTP Server</span>
                  <span className="font-mono text-foreground">{data?.smtp_host || "localhost"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Profile Shortcut */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>Company Persona & ICP</span>
                </CardTitle>
                <CardDescription>
                  The foundational knowledge Outreach uses to pitch your product or services.
                </CardDescription>
              </div>
              <Link href="/company">
                <Button variant="outline" size="xs" rightIcon={<ArrowRight className="h-3 w-3" />}>
                  Manage Persona
                </Button>
              </Link>
            </CardHeader>
          </Card>
        </div>
      )}
    </div>
  );
}
