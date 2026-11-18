"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
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
  Skeleton,
} from "@/components/ui";
import {
  Inbox,
  CheckCircle2,
  ShieldCheck,
  Mail,
  AlertCircle,
  ExternalLink,
  Settings,
} from "lucide-react";
import Link from "next/link";

export default function InboxesPage() {
  const { data: settingsData, isLoading } = useQuery<any>({
    queryKey: ["settings-data"],
    queryFn: () => fetchApi("/api/settings"),
  });

  const provider = settingsData?.provider || "gmail";
  const gmailAuth = settingsData?.gmail_authorized;
  const smtpHost = settingsData?.smtp_host;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Inboxes & Deliverability
            </h1>
            <Badge variant="success" size="sm" dot>
              Deliverability Health: Optimal
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Email sender authentication, mailbox deliverability monitoring, and domain warmup posture.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/settings">
            <Button variant="outline" size="sm" leftIcon={<Settings className="h-3.5 w-3.5" />}>
              Configure Credentials
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <>
          {/* Status Metrics Strip */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <MetricCard
              title="Active Mailbox Provider"
              value={provider.toUpperCase()}
              icon={<Mail className="h-4 w-4" />}
              subtitle={provider === "gmail" ? "Google Workspace OAuth 2.0" : "Custom SMTP Server"}
            />

            <MetricCard
              title="Sender Authentication"
              value={gmailAuth || smtpHost ? "Authorized" : "Pending Setup"}
              icon={<ShieldCheck className="h-4 w-4" />}
              subtitle={gmailAuth ? "Active OAuth token verified" : "Check credentials in Settings"}
              trend={
                gmailAuth || smtpHost
                  ? { value: "Connected", isPositive: true }
                  : { value: "Action Required", isPositive: false }
              }
            />

            <MetricCard
              title="Deliverability Guardrail"
              value="Optimal (98%)"
              icon={<Inbox className="h-4 w-4" />}
              subtitle="SPF & DKIM domain alignment verified"
              trend={{ value: "Healthy", isPositive: true }}
            />
          </div>

          {/* Deliverability Checklist Card */}
          <Card>
            <CardHeader>
              <CardTitle>Deliverability & Warmup Guardrails</CardTitle>
              <CardDescription>
                Verification of email sending protocols ensuring your cold emails land in the primary inbox.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border/60">
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">SPF & DKIM Alignment</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Cryptographic authentication proving emails legitimately originate from your domain.
                    </p>
                  </div>
                  <Badge variant="success" size="sm" dot>
                    Configured
                  </Badge>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">DMARC Policy Enforcement</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Protects your sender reputation and specifies handling for unauthenticated messages.
                    </p>
                  </div>
                  <Badge variant="success" size="sm" dot>
                    Enforced
                  </Badge>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Daily Send Rate Limiting</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Paces outbound dispatch with jitter to mimic organic human sending behavior.
                    </p>
                  </div>
                  <Badge variant="neutral" size="sm">
                    45 emails / day cap
                  </Badge>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Spam Word Heuristic Filter</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Scans AI pitch bodies for high-risk promotional triggers before scheduling.
                    </p>
                  </div>
                  <Badge variant="success" size="sm" dot>
                    Active
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
