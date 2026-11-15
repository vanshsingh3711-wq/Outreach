"use client";

import React, { useState } from "react";
import { fetchApi } from "@/lib/api-client";
import { Search, Globe, Users, Building2, CheckCircle2, AlertCircle, ArrowRight, Loader2, Mail } from "lucide-react";
import Link from "next/link";

export default function UrlEnrichmentPage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEnrich = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await fetchApi("/api/prospecting/enrich-url", {
        method: "POST",
        body: JSON.stringify({ url: url.trim() }),
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to enrich company URL.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">Target URL Enrichment</h1>
          <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
            DeepScan
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Scan any company website to extract decision-makers, verified emails, tech stack, and buying intent.
        </p>
      </div>

      <form
        onSubmit={handleEnrich}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm space-y-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-400">Target Website Domain or URL</label>
          <div className="mt-1.5 flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 transition cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Enriching...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Enrich Domain</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Enriched Result Details */}
      {result && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Company Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {result.company?.name || "Company Profile"}
                  </h3>
                  <a
                    href={result.canonical_url || url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-sky-400 hover:underline"
                  >
                    {result.company?.domain || url}
                  </a>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                {result.pages_crawled || 1} pages scanned
              </span>
            </div>

            {result.company?.description && (
              <p className="mt-4 text-xs text-slate-300 leading-relaxed">
                {result.company.description}
              </p>
            )}
          </div>

          {/* People Discovered */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-400" />
                <h3 className="font-semibold text-white text-sm">
                  Discovered Decision-Makers ({result.people?.length || 0})
                </h3>
              </div>
              <Link
                href="/decision-makers"
                className="text-xs text-sky-400 hover:underline flex items-center gap-1"
              >
                <span>View in Registry</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(result.people || []).map((person: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-white text-xs">
                        {person.first_name} {person.last_name}
                      </h4>
                      <p className="text-[11px] text-slate-400">{person.title || "Executive"}</p>
                    </div>
                    {person.role_priority && (
                      <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400 border border-indigo-500/20">
                        Priority {person.role_priority}
                      </span>
                    )}
                  </div>

                  {person.primary_email && (
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-sky-300">
                      <Mail className="h-3 w-3 text-slate-500" />
                      <span>{person.primary_email}</span>
                    </div>
                  )}

                  {person.evidence_snippet && (
                    <p className="text-[10px] text-slate-400 line-clamp-2 italic">
                      "{person.evidence_snippet}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

