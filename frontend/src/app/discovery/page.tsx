"use client";

import React, { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api-client";
import {
  Sparkles,
  Building2,
  Search,
  Globe,
  Users,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Database,
  Mail,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  PlusCircle,
  Briefcase,
  ShieldCheck,
} from "lucide-react";
import { LinkedInIcon, TwitterXIcon } from "@/components/ui/brand-icons";
import Link from "next/link";

function formatLinkedInUrl(url?: string): string {
  if (!url) return "";
  const cleaned = url.replace(/https?:\/\/([a-z]{2,3}\.)?linkedin\.com/i, "https://www.linkedin.com");
  const base = cleaned.split("?")[0];
  return `${base}?locale=en_US`;
}

interface DecisionMakerPreview {
  id?: string;
  first_name: string;
  last_name: string;
  title: string;
  email?: string;
  email_status?: string;
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
}

interface DiscoveredCompany {
  id: string;
  company_id?: string;
  name: string;
  domain: string;
  website?: string;
  industry?: string;
  location?: string;
  description?: string;
  snippet?: string;
  contact_count?: number;
  fit_score?: number;
  signals?: string[];
  people?: DecisionMakerPreview[];
  is_existing?: boolean;
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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Per-company enrichment loading state
  const [enrichingDomain, setEnrichingDomain] = useState<string | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "with_leads" | "need_leads">("all");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Load saved companies and their decision-makers on mount so nothing ever disappears
  const loadSavedAccounts = async () => {
    try {
      setIsLoadingExisting(true);
      const [companies, dmRes] = await Promise.all([
        fetchApi<any[]>("/api/companies").catch(() => []),
        fetchApi<{ decision_makers: any[] }>("/api/prospecting/decision-makers?limit=500").catch(() => ({ decision_makers: [] })),
      ]);

      const dms = dmRes?.decision_makers || [];
      const dmsByDomain: Record<string, DecisionMakerPreview[]> = {};
      const dmsByCompId: Record<string, DecisionMakerPreview[]> = {};

      for (const dm of dms) {
        const item: DecisionMakerPreview = {
          id: dm.id,
          first_name: dm.first_name,
          last_name: dm.last_name,
          title: dm.title,
          email: dm.email,
          email_status: dm.email_status,
          linkedin_url: dm.linkedin_url,
          twitter_url: dm.twitter_url,
          github_url: dm.github_url,
        };
        if (dm.company_domain) {
          const dom = dm.company_domain.toLowerCase().trim();
          dmsByDomain[dom] = dmsByDomain[dom] || [];
          dmsByDomain[dom].push(item);
        }
        if (dm.company_id) {
          dmsByCompId[dm.company_id] = dmsByCompId[dm.company_id] || [];
          dmsByCompId[dm.company_id].push(item);
        }
      }

      const mapped: DiscoveredCompany[] = (companies || []).map((c) => {
        const dom = (c.domain || "").toLowerCase().trim();
        const attachedPeople = dmsByDomain[dom] || dmsByCompId[c.id] || [];
        return {
          id: c.id,
          company_id: c.id,
          name: c.name || c.domain,
          domain: c.domain,
          website: c.website || `https://${c.domain}`,
          industry: c.industry,
          location: c.location,
          description: c.description || c.notes,
          contact_count: attachedPeople.length || c.contact_count || 0,
          people: attachedPeople,
          fit_score: c.fit,
        };
      });

      setResults(mapped);
    } catch (err) {
      console.error("Failed to load saved accounts:", err);
    } finally {
      setIsLoadingExisting(false);
    }
  };

  useEffect(() => {
    loadSavedAccounts();
  }, []);

  const handleRunDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        industries: industries.split(",").map((s) => s.trim()).filter(Boolean),
        tech_stack: techStack.split(",").map((s) => s.trim()).filter(Boolean),
        locations: location.split(",").map((s) => s.trim()).filter(Boolean),
        custom_query: customQuery.trim(),
        limit: 12,
        auto_enrich: autoEnrich,
      };

      const res = await fetchApi<{ success: boolean; count: number; companies: any[] }>(
        "/api/prospecting/discover",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      const incoming = (res.companies || []).map((c) => ({
        id: c.company_id || c.id,
        company_id: c.company_id || c.id,
        name: c.name,
        domain: c.domain,
        website: c.website,
        description: c.description || c.snippet,
        industry: c.industry,
        location: c.location,
        contact_count: c.contact_count || (c.people ? c.people.length : 0),
        people: c.people || [],
        is_existing: c.is_existing,
      }));

      // Merge new results with existing, keeping unique domains
      setResults((prev) => {
        const existingDomains = new Set(prev.map((p) => p.domain.toLowerCase()));
        const fresh = incoming.filter((item) => !existingDomains.has(item.domain.toLowerCase()));
        return [...fresh, ...prev];
      });

      setSuccessMsg(
        `Discovered ${res.count || incoming.length} companies matching your criteria! All saved directly to your database.`
      );
      // Reload from DB to ensure complete sync
      setTimeout(() => loadSavedAccounts(), 1500);
    } catch (err: any) {
      setError(err.message || "Failed to run ICP discovery.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleEnrichCompany = async (company: DiscoveredCompany) => {
    const targetUrl = company.website || `https://${company.domain}`;
    setEnrichingDomain(company.domain);
    setError(null);

    try {
      const res = await fetchApi<{
        success: boolean;
        company: any;
        people: DecisionMakerPreview[];
      }>("/api/prospecting/enrich-url", {
        method: "POST",
        body: JSON.stringify({ url: targetUrl }),
      });

      if (res.success && res.people) {
        setResults((prev) =>
          prev.map((c) =>
            c.domain.toLowerCase() === company.domain.toLowerCase()
              ? {
                  ...c,
                  contact_count: res.people.length,
                  people: res.people,
                  description: res.company?.description || c.description,
                  location: res.company?.location || c.location,
                  industry: res.company?.industry || c.industry,
                }
              : c
          )
        );
        setSuccessMsg(
          `Enriched ${company.name}! Found and saved ${res.people.length} real decision-maker(s) to your database.`
        );
      }
    } catch (err: any) {
      setError(`Failed to enrich ${company.name}: ${err.message}`);
    } finally {
      setEnrichingDomain(null);
    }
  };

  // Filter accounts
  const filteredResults = results.filter((c) => {
    const matchesSearch =
      !searchFilter ||
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.domain.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (c.industry && c.industry.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (c.people && c.people.some((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchFilter.toLowerCase())));

    if (!matchesSearch) return false;

    if (activeTab === "with_leads") {
      return (c.contact_count || 0) > 0 || (c.people && c.people.length > 0);
    }
    if (activeTab === "need_leads") {
      return (c.contact_count || 0) === 0 && (!c.people || c.people.length === 0);
    }
    return true;
  });

  const totalWithLeads = results.filter((c) => (c.contact_count || 0) > 0 || (c.people && c.people.length > 0)).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">ICP Account Discovery</h1>
            <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 border border-sky-500/20">
              DeepSeek Scout
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Identify high-fit target companies matching your ideal customer profile, extract verified decision-makers, and auto-save leads to your pipeline.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-1.5 text-xs">
            <Database className="h-4 w-4 text-emerald-400" />
            <span className="text-slate-300 font-medium">{results.length} Saved in DB</span>
          </div>
          <button
            onClick={loadSavedAccounts}
            disabled={isLoadingExisting}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:border-slate-700 transition cursor-pointer"
            title="Refresh accounts from database"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingExisting ? "animate-spin" : ""}`} />
            <span>Sync DB</span>
          </button>
        </div>
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

        {successMsg && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
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
            <span>Deep web enrichment (auto-crawl site & extract decision-makers)</span>
          </label>
          <button
            type="submit"
            disabled={isRunning}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/25 hover:opacity-95 transition cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>DeepSeek Scout Searching & Saving...</span>
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

      {/* Discovered Accounts Controls & Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "all"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              All Discovered ({results.length})
            </button>
            <button
              onClick={() => setActiveTab("with_leads")}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "with_leads"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              With Verified Leads ({totalWithLeads})
            </button>
            <button
              onClick={() => setActiveTab("need_leads")}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "need_leads"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              Need Leads ({results.length - totalWithLeads})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search companies or leads..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Loading skeleton or empty state */}
        {isLoadingExisting && results.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center text-slate-500 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
            <span>Loading saved accounts from database...</span>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center text-slate-500">
            {searchFilter ? "No companies matched your search filter." : 'No accounts found yet. Adjust criteria above and click "Run AI Discovery".'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredResults.map((c) => {
              const hasLeads = (c.people && c.people.length > 0) || (c.contact_count || 0) > 0;
              const isEnrichingThis = enrichingDomain === c.domain;

              return (
                <div
                  key={c.id || c.domain}
                  className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm hover:border-slate-700 transition flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-white text-sm truncate" title={c.name}>
                            {c.name}
                          </h3>
                          <a
                            href={c.website || `https://${c.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[11px] text-slate-400 hover:text-sky-400 transition flex items-center gap-1"
                          >
                            <span>{c.domain}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                          <Database className="h-2.5 w-2.5" />
                          Saved in DB
                        </span>
                        {c.fit_score ? (
                          <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-400 border border-sky-500/20">
                            {c.fit_score}% Fit
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Description */}
                    {c.description && (
                      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {c.description}
                      </p>
                    )}

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                      {c.industry && (
                        <span className="rounded-lg bg-slate-800/60 px-2 py-0.5 text-slate-300">
                          {c.industry}
                        </span>
                      )}
                      <span className="rounded-lg bg-slate-800/60 px-2 py-0.5 text-slate-400">
                        {c.location || "Remote / US"}
                      </span>
                    </div>

                    {/* Verified Decision Makers Section */}
                    {c.people && c.people.length > 0 ? (
                      <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-2 mt-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 border-b border-slate-800/60 pb-1.5">
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Verified Decision-Makers ({c.people.length})
                          </span>
                          <span className="text-[10px] text-slate-500">Auto-Saved</span>
                        </div>

                        <div className="space-y-2">
                          {c.people.slice(0, 2).map((p, idx) => (
                            <div key={idx} className="text-xs space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-medium text-slate-200">
                                  {p.first_name} {p.last_name}
                                </span>
                                <span className="text-[10px] text-slate-400 truncate max-w-[130px]" title={p.title}>
                                  {p.title}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                {p.email ? (
                                  <button
                                    onClick={() => handleCopyEmail(p.email!)}
                                    className="flex items-center gap-1 font-mono text-sky-400 hover:text-sky-300 transition text-[11px] cursor-pointer"
                                    title="Click to copy email"
                                  >
                                    <Mail className="h-3 w-3 shrink-0" />
                                    <span className="truncate max-w-[140px]">{p.email}</span>
                                    {copiedEmail === p.email ? (
                                      <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-2.5 w-2.5 text-slate-500" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-slate-500 text-[10px]">Email resolving...</span>
                                )}

                                {p.linkedin_url && (
                                  <a
                                    href={formatLinkedInUrl(p.linkedin_url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[#0A66C2] hover:underline text-[10px] shrink-0"
                                  >
                                    <LinkedInIcon className="h-3 w-3" />
                                    <span>Profile</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}

                          {c.people.length > 2 && (
                            <p className="text-[10px] text-slate-500 text-center pt-1">
                              +{c.people.length - 2} more decision-makers saved in DB
                            </p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    {hasLeads ? (
                      <Link
                        href={`/decision-makers?search=${encodeURIComponent(c.name)}`}
                        className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition"
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>View All Leads ({c.contact_count || (c.people ? c.people.length : 0)})</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleEnrichCompany(c)}
                        disabled={isEnrichingThis}
                        className="flex items-center gap-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition cursor-pointer disabled:opacity-50"
                      >
                        {isEnrichingThis ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Finding Decision-Makers...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                            <span>Find Decision-Makers & Emails</span>
                          </>
                        )}
                      </button>
                    )}

                    <Link
                      href={`/decision-makers?search=${encodeURIComponent(c.name)}`}
                      className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1"
                      title="Open full prospect details"
                    >
                      <span>Pipeline</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


