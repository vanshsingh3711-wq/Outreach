"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import {
  MessageSquare,
  Mail,
  User,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Check,
  RotateCcw,
  Sparkles,
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
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">Conversations & Replies</h1>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            {convos.length} Threads
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Inbound replies, sentiment analysis, and intelligent human handoff threads.
        </p>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-400 mb-2" />
          <span>Loading email conversations...</span>
        </div>
      ) : convos.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center text-slate-500">
          No conversations recorded yet. Outbound replies will stream here automatically.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Conversation list */}
          <div className="space-y-2 lg:col-span-1 overflow-y-auto max-h-[700px]">
            {convos.map((convo) => {
              const isSelected = selectedConvo?.id === convo.id;
              const needsHuman = convo.status === "needs_human";
              const isClosed = convo.status === "closed";

              return (
                <div
                  key={convo.id}
                  onClick={() => setSelectedConvoId(convo.id)}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    isSelected
                      ? "border-emerald-500/50 bg-slate-900/90 shadow-md ring-1 ring-emerald-500/20"
                      : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-xs truncate max-w-[150px]">
                      {convo.first_name ? `${convo.first_name} ${convo.last_name || ""}` : convo.prospect_email}
                    </span>
                    {needsHuman ? (
                      <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-rose-400 border border-rose-500/30">
                        Needs You
                      </span>
                    ) : isClosed ? (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                        Closed
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                        Open
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 truncate">
                    {convo.company || "Company"}
                  </div>
                  <div className="mt-2 text-xs font-medium text-slate-300 truncate">
                    {convo.subject || "Reply Thread"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Conversation Thread Detail */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 lg:col-span-2 space-y-4">
            {selectedConvo ? (
              <>
                <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="font-bold text-white text-base">
                      {selectedConvo.first_name} {selectedConvo.last_name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {selectedConvo.prospect_email} · {selectedConvo.company}
                    </p>
                  </div>

                  {/* Close / Reopen Actions */}
                  <div className="flex items-center gap-2">
                    {selectedConvo.status === "closed" ? (
                      <button
                        onClick={() =>
                          statusMutation.mutate({ id: selectedConvo.id, status: "open" })
                        }
                        disabled={statusMutation.isPending}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Reopen</span>
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          statusMutation.mutate({ id: selectedConvo.id, status: "closed" })
                        }
                        disabled={statusMutation.isPending}
                        className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Mark Handled / Close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Email History / Exchange */}
                <div className="space-y-4 py-2 max-h-[500px] overflow-y-auto">
                  {selectedConvo.emails?.map((e: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-sky-400">Outbound Sent</span>
                        <span>{e.sent_at || "Recent"}</span>
                      </div>
                      <div className="font-semibold text-xs text-white">Subject: {e.subject}</div>
                      <div className="font-mono text-xs text-slate-300 whitespace-pre-wrap pt-1">
                        {e.body}
                      </div>
                    </div>
                  ))}

                  {selectedConvo.thread?.map((msg: any, idx: number) => {
                    const isFromThem = msg.role === "user" || msg.from !== "me";
                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border p-4 space-y-1.5 ${
                          isFromThem
                            ? "border-emerald-500/30 bg-emerald-950/20"
                            : "border-slate-800 bg-slate-950/70"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={isFromThem ? "font-semibold text-emerald-400" : "font-semibold text-sky-400"}>
                            {isFromThem ? "Prospect Reply" : "Outreach Reply"}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-slate-200 whitespace-pre-wrap">
                          {msg.content || msg.text || msg.body}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
