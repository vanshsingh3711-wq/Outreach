"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { Building2, Save, Sparkles, Check, Loader2 } from "lucide-react";

export default function CompanyProfilePage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<any>({
    queryKey: ["company-config"],
    queryFn: () => fetchApi("/api/company"),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">Your Company & Value Proposition</h1>
          <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 border border-sky-500/20">
            Persona & ICP
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Everything Outreach writes from: what you sell, who you sell to, and your core call to action.
        </p>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky-400 mb-2" />
          <span>Loading company profile...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* What you sell */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-white">What You Sell</h3>
            <p className="text-xs text-slate-400">The product or service Outreach pitches in outbound messages.</p>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
              {data?.product || data?.what_you_sell || "Outreach — Autonomous AI B2B Outbound Engine"}
            </div>
          </div>

          {/* Target Audience / ICP */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-white">Ideal Customer Profile (ICP)</h3>
            <p className="text-xs text-slate-400">Target company size, technical stack, and ideal roles.</p>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
              {data?.icp || data?.who_you_sell_to || "Founders, VP Engineering, CTOs, and Heads of Sales"}
            </div>
          </div>

          {/* The Offer */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-white">Core Offer / Call to Action</h3>
            <p className="text-xs text-slate-400">The primary hook closing each cold email.</p>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
              {data?.offer || data?.the_offer || "A 15-minute quick walkthrough of the autonomous agent pipeline."}
            </div>
          </div>

          {/* Sender Persona */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-white">Sender Persona</h3>
            <p className="text-xs text-slate-400">The identity and voice signing the emails.</p>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
              {data?.sender || data?.who_its_from || "Vansh Singh — Founder"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

