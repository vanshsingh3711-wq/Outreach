"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  MessageSquare,
  Mail,
  User,
  Check,
  RotateCcw,
  Sparkles,
  Building2,
  Send,
  Clock,
  ArrowRight,
} from "lucide-react";

export default function ConversationsPage() {
  const queryClient = useQueryClient();
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["conversations-list"],
    queryFn: () => fetchApi<any[]>("/api/conversations"),
    refetchInterval: 4000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "open" | "closed" }) =>
      fetchApi(`/api/conversations/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations-list"] });
      queryClient.invalidateQueries({ queryKey: ["today-dashboard"] });
    },
  });

  const convos = data || [];
  const selectedConvo = convos.find((c) => c.id === selectedConvoId) || convos[0];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Conversations & Inbound Replies
            </h1>
            <Badge variant="neutral" size="sm" className="font-mono">
              {convos.length} Threads
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Inbound prospect responses, sentiment classification, and human handoff threads.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="lg:col-span-8">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      ) : convos.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-3">
            <MessageSquare className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No conversations recorded yet</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            When prospects reply to outbound emails, their response threads and sentiment analysis will stream here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
          {/* Left Master List (4 cols) */}
          <div className="space-y-2 lg:col-span-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {convos.map((convo) => {
              const isSelected = selectedConvo?.id === convo.id;
              const needsHuman = convo.status === "needs_human";
              const isClosed = convo.status === "closed";

              return (
                <div
                  key={convo.id}
                  onClick={() => setSelectedConvoId(convo.id)}
                  className={`rounded-lg border p-3.5 transition-all cursor-pointer select-none ${
                    isSelected
                      ? "border-primary/40 bg-secondary shadow-2xs"
                      : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground text-xs truncate">
                      {convo.first_name ? `${convo.first_name} ${convo.last_name || ""}` : convo.prospect_email}
                    </span>
                    <Badge
                      variant={needsHuman ? "destructive" : isClosed ? "neutral" : "success"}
                      size="sm"
                      dot={needsHuman}
                      pulseDot={needsHuman}
                    >
                      {needsHuman ? "Needs You" : isClosed ? "Closed" : "Open"}
                    </Badge>
                  </div>

                  <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                    {convo.company || "Target Company"}
                  </p>

                  <p className="mt-2 text-xs font-medium text-foreground/90 truncate">
                    {convo.subject || "Reply Thread"}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Right Detail Transcript (8 cols) */}
          <Card className="lg:col-span-8 flex flex-col sticky top-20 overflow-hidden">
            {selectedConvo ? (
              <>
                {/* Header Actions */}
                <div className="flex items-start justify-between border-b border-border bg-muted/20 p-4">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">
                      {selectedConvo.first_name} {selectedConvo.last_name}
                    </h3>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                      {selectedConvo.prospect_email} · {selectedConvo.company}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedConvo.status === "closed" ? (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() =>
                          statusMutation.mutate({ id: selectedConvo.id, status: "open" })
                        }
                        disabled={statusMutation.isPending}
                        leftIcon={<RotateCcw className="h-3 w-3" />}
                      >
                        Reopen Thread
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          statusMutation.mutate({ id: selectedConvo.id, status: "closed" })
                        }
                        disabled={statusMutation.isPending}
                        leftIcon={<Check className="h-3 w-3" />}
                      >
                        Mark Handled
                      </Button>
                    )}
                  </div>
                </div>

                {/* Messages Transcript */}
                <div className="p-5 space-y-3.5 max-h-[calc(100vh-320px)] overflow-y-auto">
                  {selectedConvo.emails?.map((e: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-border bg-muted/30 p-4 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-semibold text-primary">Outbound Pitch Dispatched</span>
                        <span className="font-mono">{e.sent_at || "Recent"}</span>
                      </div>
                      <div className="font-medium text-xs text-foreground">Subject: {e.subject}</div>
                      <div className="font-mono text-xs text-muted-foreground whitespace-pre-wrap pt-1 leading-relaxed">
                        {e.body}
                      </div>
                    </div>
                  ))}

                  {selectedConvo.thread?.map((msg: any, idx: number) => {
                    const isFromThem = msg.role === "user" || msg.from !== "me";
                    return (
                      <div
                        key={idx}
                        className={`rounded-lg border p-4 space-y-1.5 ${
                          isFromThem
                            ? "border-emerald-500/20 bg-emerald-500/5 text-foreground"
                            : "border-border bg-muted/20"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span
                            className={
                              isFromThem
                                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                                : "font-semibold text-primary"
                            }
                          >
                            {isFromThem ? "Prospect Inbound Reply" : "Outreach Response"}
                          </span>
                        </div>
                        <div className="font-mono text-xs whitespace-pre-wrap leading-relaxed">
                          {msg.content || msg.text || msg.body}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}
