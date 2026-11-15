"use client";

import React, { useState } from "react";
import { fetchApi } from "@/lib/api-client";
import {
  Search,
  Globe,
  Users,
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Mail,
  Copy,
  Check,
  BookmarkPlus,
  Zap,
} from "lucide-react";
import { LinkedInIcon } from "@/components/ui/brand-icons";
import Link from "next/link";

export default function UrlEnrichmentPage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const formatLinkedInUrl = (rawUrl: string) => {
    if (!rawUrl) return "";
    let clean = rawUrl.trim();
    clean = clean.replace(/https?:\/\/[a-z]{2,3}\.linkedin\.com/i, "https://www.linkedin.com");
    if (!clean.startsWith("http")) {
      clean = `https://${clean}`;
    }
    if (!clean.includes("locale=en_US")) {
      clean += clean.includes("?") ? "&locale=en_US" : "?locale=en_US";
    }
    return clean;
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleEnrich = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setIsSaved(false);

    try {
      const data = await fetchApi<any>("/api/prospecting/enrich-url", {
        method: "POST",
        body: JSON.stringify({ url: url.trim(), persist: false }),
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to enrich company URL.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToDb = async () => {
    if (!result || !result.company) return;
    setIsSaving(true);
    try {
      await fetchApi("/api/prospecting/save-lead", {
        method: "POST",
        body: JSON.stringify({
          domain: result.company.domain,
          name: result.company.name,
          website: result.canonical_url || result.company.website,
          description: result.company.description,
          industry: result.company.industry,
          location: result.company.location,
          people: (result.people || []).map((p: any) => ({
            first_name: p.first_name,
            last_name: p.last_name,
            title: p.title,
            email: p.primary_email,
            email_status: p.email_status,
            linkedin_url: p.linkedin_url,
          })),
        }),
      });
      setIsSaved(true);
    } catch (err: any) {
      setError(err.message || "Failed to save lead to database.");
    } finally {
      setIsSaving(false);
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
          Results are staged temporarily until you choose to save them.
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
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">
                      {result.company?.name || "Company Profile"}
                    </h3>
                    {isSaved ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Saved in DB
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        <Zap className="h-3 w-3" />
                        ⚡ Temporary Preview
                      </span>
                    )}
                  </div>
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

              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-700">
                  {result.pages_crawled?.length || 1} pages scanned
                </span>

                {!isSaved ? (
                  <button
                    type="button"
                    onClick={handleSaveToDb}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="h-3.5 w-3.5" />
                        <span>Save to DB</span>
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={`/decision-makers?search=${encodeURIComponent(result.company?.name || "")}`}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 font-semibold px-4 py-2 text-xs transition border border-slate-700"
                  >
                    <span>View in Pipeline</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
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
              <span className="text-xs text-slate-400">
                {isSaved ? "Saved permanently in your pipeline" : "Temporary staged leads"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(result.people || []).map((person: any, idx: number) => {
                const isCopied = copiedEmail === person.primary_email;
                const formattedLinkedIn = person.linkedin_url ? formatLinkedInUrl(person.linkedin_url) : "";

                return (
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
                      <div className="flex items-center gap-1.5">
                        {formattedLinkedIn && (
                          <a
                            href={formattedLinkedIn}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-sky-400 p-1 rounded hover:bg-slate-800 transition"
                            title="Open LinkedIn in English"
                          >
                            <LinkedInIcon className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {person.role_priority && (
                          <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400 border border-indigo-500/20">
                            P{person.role_priority}
                          </span>
                        )}
                      </div>
                    </div>

                    {person.primary_email && (
                      <div className="flex items-center justify-between gap-1.5 font-mono text-[11px] bg-slate-900/80 px-2 py-1 rounded border border-slate-800 text-sky-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="h-3 w-3 text-slate-500 shrink-0" />
                          <span className="truncate">{person.primary_email}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyEmail(person.primary_email)}
                          className="text-slate-400 hover:text-white p-0.5 transition shrink-0 cursor-pointer"
                          title="Copy email address"
                        >
                          {isCopied ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    {person.evidence_snippet && (
                      <p className="text-[10px] text-slate-400 line-clamp-2 italic">
                        "{person.evidence_snippet}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
