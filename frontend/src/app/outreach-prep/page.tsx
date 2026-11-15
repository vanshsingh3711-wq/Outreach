"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { PenTool, Sparkles, Send, Building2, User, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function OutreachPrepPage() {
  const [targetName, setTargetName] = useState("Vansh Singh");
  const [targetTitle, setTargetTitle] = useState("Founder & CTO");
  const [targetCompany, setTargetCompany] = useState("Acme Analytics");
  const [painPoint, setPainPoint] = useState("Struggling with outbound lead pipeline scalability and manual research");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<{ subject: string; body: string } | null>(null);

  const handleSimulateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGeneratedDraft(null);

    // Simulate pitch preview using Brain template principles
    setTimeout(() => {
      setGeneratedDraft({
        subject: `Quick question regarding ${targetCompany}'s outbound architecture`,
        body: `Hi ${targetName.split(" ")[0]},\n\nNoticed ${targetCompany} is scaling rapidly. Often engineering teams at your stage face challenges with ${painPoint.toLowerCase()}.\n\nWe built Outreach to automate B2B outbound workflows directly with native AI models, cutting lead discovery and validation time by 90%.\n\nOpen to a quick 10-minute walkthrough this Thursday?\n\nBest,\nOutreach Team`,
      });
      setIsGenerating(false);
    }, 800);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Outreach Prep & Pitch Studio</h1>
            <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              DeepSeek Writer
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Interactive playground to test email angles, value hooks, and tone customization.
          </p>
        </div>

        <Link
          href="/decision-makers"
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/20"
        >
          <span>Open Decision-Makers</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Input Parameters Form */}
        <form
          onSubmit={handleSimulateDraft}
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <PenTool className="h-4 w-4 text-indigo-400" />
            <h3 className="font-semibold text-white text-sm">Persona & Angle Parameters</h3>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400">Decision-Maker Name</label>
            <input
              type="text"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400">Title / Role</label>
              <input
                type="text"
                value={targetTitle}
                onChange={(e) => setTargetTitle(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400">Company Name</label>
              <input
                type="text"
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400">
              Identified Pain Point / Buying Signal
            </label>
            <textarea
              rows={3}
              value={painPoint}
              onChange={(e) => setPainPoint(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating Pitch...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Simulate AI Pitch</span>
              </>
            )}
          </button>
        </form>

        {/* Generated Preview Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white text-sm">DeepSeek Pitch Preview</h3>
            <span className="text-[11px] text-slate-400">Personalized Draft</span>
          </div>

          {generatedDraft ? (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-medium text-slate-400">Subject:</span>
                <p className="mt-1 text-xs font-semibold text-sky-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  {generatedDraft.subject}
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-400">Body:</span>
                <div className="mt-1 rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {generatedDraft.body}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-500">
              Configure parameters on the left and click "Simulate AI Pitch" to preview customized copy.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
