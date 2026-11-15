"use client";

import React, { useState } from "react";
import { fetchApi } from "@/lib/api-client";
import { Sparkles, Building2, Search, Globe, Users, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface DiscoveredCompany {
  id: string;
  name: string;
  domain: string;
  website?: string;
  industry?: string;
  location?: string;
  description?: string;
  fit_score?: number;
  signals?: string[];
}

export default function DiscoveryPage() {
  const [industries, setIndustries] = useState("AI, SaaS, Developer Tools");
  const [techStack, setTechStack] = useState("Python, FastAPI, Next.js");
  const [location, setLocation] = useState("United States, Remote");
  const [customQuery, setCustomQuery] = useState("");
  const [autoEnrich, setAutoEnrich] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiscoveredCompany[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRunDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    setError(null);

    try {
      const payload = {
        industries: industries.split(",").map((s) => s.trim()).filter(Boolean),
        tech_stack: techStack.split(",").map((s) => s.trim()).filter(Boolean),
        locations: location.split(",").map((s) => s.trim()).filter(Boolean),
        custom_query: customQuery.trim(),
        limit: 12,
        auto_enrich: autoEnrich,
      };

      const res = await fetchApi<{ success: boolean; count: number; companies: DiscoveredCompany[] }>(
        "/api/prospecting/discover",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setResults(res.companies || []);
    } catch (err: any) {
      setError(err.message || "Failed to run ICP discovery.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">ICP Account Discovery</h1>
          <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 border border-sky-500/20">
            DeepSeek Scout
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Identify high-fit target companies matching your ideal customer profile, tech stack, and buying signals.
        </p>
      </div>

      {/* Discovery Criteria Form */}
      <form
        onSubmit={handleRunDiscovery}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-400">Target Industries</label>
            <input
              type="text"
              value={industries}
              onChange={(e) => setIndustries(e.target.value)}
              placeholder="e.g. AI, B2B SaaS, HealthTech"
              className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400">Tech Stack Signals</label>
            <input
              type="text"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="e.g. Next.js, Postgres, Kubernetes"
              className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400">Headquarters / Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. San Francisco, US, Europe"
              className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400">
            Custom Prompt / Ideal Persona Query
          </label>
          <input
            type="text"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder="e.g. Fast-growing Series A/B engineering teams shipping developer infrastructure"
            className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none hover:text-slate-200 transition">
            <input
              type="checkbox"
              checked={autoEnrich}
              onChange={(e) => setAutoEnrich(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500/20"
            />
            <span>Deep web enrichment (crawl & extract tech signals)</span>
          </label>
          <button
            type="submit"
            disabled={isRunning}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/25 hover:opacity-95 transition cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>DeepSeek Scout Searching...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Run AI Discovery</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Discovered Accounts Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Discovered Accounts {results.length > 0 && `(${results.length})`}
        </h2>

        {results.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center text-slate-500">
            No accounts discovered yet. Adjust your criteria and click "Run AI Discovery".
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((c) => (
              <div
                key={c.id || c.domain}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-sm hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{c.name}</h3>
                      <span className="font-mono text-[11px] text-slate-400">{c.domain}</span>
                    </div>
                  </div>

                  {c.fit_score && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                      {c.fit_score}% Fit
                    </span>
                  )}
                </div>

                {c.description && (
                  <p className="mt-3 text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {c.description}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">{c.location || "Remote / US"}</span>
                  <Link
                    href={`/decision-makers?search=${encodeURIComponent(c.name)}`}
                    className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium"
                  >
                    <span>View Leads</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

