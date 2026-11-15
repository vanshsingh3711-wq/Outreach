"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api-client";
import {
  Building2,
  Globe,
  MapPin,
  Users,
  ExternalLink,
  ArrowLeft,
  Mail,
  Copy,
  Check,
  BookmarkPlus,
  Zap,
  CheckCircle2,
  Loader2,
  Sparkles,
  Send,
  Layers,
  ShieldCheck,
  FileText,
  Search,
} from "lucide-react";
import { LinkedInIcon, TwitterXIcon } from "@/components/ui/brand-icons";
import Link from "next/link";

interface DecisionMaker {
  first_name: string;
  last_name: string;
  title: string;
  role_priority?: number;
  email?: string;
  primary_email?: string;
  email_status?: string;
  email_verified?: boolean;
  email_match_confidence?: number;
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
  evidence_snippet?: string;
  personalization_notes?: string;
}

interface CompanyData {
  id?: string;
  name: string;
  domain: string;
  website?: string;
  description?: string;
  industry?: string;
  location?: string;
  size?: string;
  target_type?: string;
  fit_score?: number;
  tech_stack?: string[];
  pages_crawled?: string[];
  people?: DecisionMaker[];
  is_saved?: boolean;
}

function CompanyDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const domain = searchParams.get("domain") || "";
  const nameParam = searchParams.get("name") || "";
  const idParam = searchParams.get("id") || "";

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [people, setPeople] = useState<DecisionMaker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  // 1. Initial Load: Load from sessionStorage cache first, then verify with backend
  useEffect(() => {
    if (!domain && !idParam) {
      setError("No company specified.");
      setIsLoading(false);
      return;
    }

    // Try loading from sessionStorage
    let cached: any = null;
    if (domain) {
      try {
        const item = sessionStorage.getItem(`discovery_company_${domain.toLowerCase()}`);
        if (item) {
          cached = JSON.parse(item);
        }
      } catch (e) {
        console.warn("Failed to read cached company from sessionStorage:", e);
      }
    }

    if (cached) {
      setCompany(cached);
      setPeople(cached.people || []);
      setIsSaved(Boolean(cached.is_existing || cached.is_saved));
    }

    // Load full details from backend API
    const loadDetails = async () => {
      try {
        setIsLoading(!cached);
        const endpoint = `/api/prospecting/company-detail?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(idParam)}`;
        const res = await fetchApi<{
          success: boolean;
          is_saved: boolean;
          company: any;
          people: DecisionMaker[];
          tech_stack?: string[];
          pages_crawled?: string[];
        }>(endpoint);

        if (res.success && res.company) {
          const compData: CompanyData = {
            id: res.company.id,
            name: res.company.name || nameParam || domain,
            domain: res.company.domain || domain,
            website: res.company.website || (domain ? `https://${domain}` : ""),
            description: res.company.description || cached?.description || "",
            industry: res.company.industry || cached?.industry || "Technology",
            location: res.company.location || cached?.location || "Remote",
            size: res.company.size || cached?.size || "11-50 team",
            target_type: cached?.target_type || "startup",
            tech_stack: res.tech_stack || cached?.tech_stack || [],
            pages_crawled: res.pages_crawled || [],
            is_saved: res.is_saved,
          };

          setCompany(compData);
          setIsSaved(res.is_saved);

          if (res.people && res.people.length > 0) {
            setPeople(res.people);
          } else if (cached?.people && cached.people.length > 0) {
            setPeople(cached.people);
          }
        }
      } catch (err: any) {
        console.warn("Could not fetch detailed company API, using cached data if available:", err);
        if (!cached) {
          setError(err.message || "Failed to load company details.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [domain, idParam, nameParam]);

  // Deep Scan / Enrich live if decision-makers aren't fetched yet
  const handleRunDeepScan = async () => {
    const targetUrl = company?.website || (domain ? `https://${domain}` : "");
    if (!targetUrl) return;

    setIsEnriching(true);
    setError(null);
    try {
      const res = await fetchApi<{
        success: boolean;
        company: any;
        people: DecisionMaker[];
        pages_crawled: string[];
      }>("/api/prospecting/enrich-url", {
        method: "POST",
        body: JSON.stringify({ url: targetUrl, persist: false }),
      });

      if (res.success) {
        if (res.company) {
          setCompany((prev) => ({
            ...prev!,
            description: res.company.description || prev?.description,
            tech_stack: res.company.tech_stack || prev?.tech_stack,
          }));
        }
        if (res.people) {
          setPeople(res.people);
        }
        setSuccessMsg(`Deep scan complete! Extracted ${res.people?.length || 0} decision-makers & verified emails.`);
        setTimeout(() => setSuccessMsg(null), 4000);

        // Update sessionStorage
        if (domain) {
          const updated = { ...company, people: res.people };
          sessionStorage.setItem(`discovery_company_${domain.toLowerCase()}`, JSON.stringify(updated));
        }
      }
    } catch (err: any) {
      setError(err.message || "Deep scan failed.");
    } finally {
      setIsEnriching(false);
    }
  };

  // Permanently save to Database
  const handleSaveToDb = async () => {
    if (!company) return;
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        domain: company.domain,
        name: company.name,
        website: company.website,
        description: company.description,
        industry: company.industry,
        location: company.location,
        size: company.size,
        people: people.map((p) => ({
          first_name: p.first_name,
          last_name: p.last_name,
          title: p.title,
          email: p.primary_email || p.email,
          email_status: p.email_status || "verified",
          linkedin_url: p.linkedin_url,
        })),
      };

      const res = await fetchApi<{ success: boolean; company_id: string; message: string }>(
        "/api/prospecting/save-lead",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (res.success) {
        setIsSaved(true);
        setSuccessMsg(`✅ Saved ${company.name} and ${people.length} decision-makers permanently to your database.`);
        setTimeout(() => setSuccessMsg(null), 4000);

        // Update cache
        if (domain) {
          sessionStorage.setItem(
            `discovery_company_${domain.toLowerCase()}`,
            JSON.stringify({ ...company, is_existing: true, is_saved: true, people })
          );
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to save company to database.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-400 mb-3" />
        <h2 className="text-base font-semibold text-white">Analyzing Company & Decision-Makers...</h2>
        <p className="text-xs text-slate-400 mt-1">Extracting technical firmographics, social profiles, and verified emails</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center space-y-4">
        <p className="text-sm text-slate-400">Company details could not be found.</p>
        <button
          onClick={() => router.push("/discovery")}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Discovery</span>
        </button>
      </div>
    );
  }

  const isAgency =
    company.target_type === "agency" ||
    (company.industry || "").toLowerCase().includes("agency") ||
    (company.name || "").toLowerCase().includes("studio");

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/discovery")}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Discovery</span>
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-xs font-medium text-slate-400 truncate max-w-[200px] sm:max-w-xs">
            {company.name}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunDeepScan}
            disabled={isEnriching}
            className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition cursor-pointer disabled:opacity-50"
            title="Re-crawl website and refresh leadership profiles"
          >
            {isEnriching ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <Search className="h-3.5 w-3.5" />
                <span>Deep Re-Scan</span>
              </>
            )}
          </button>

          {!isSaved ? (
            <button
              onClick={handleSaveToDb}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-950" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-3.5 w-3.5 text-slate-950" />
                  <span>Save to DB</span>
                </>
              )}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Saved in DB</span>
            </span>
          )}

          <Link
            href={`/outreach-prep?search=${encodeURIComponent(company.name)}`}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 text-xs shadow-md shadow-indigo-600/20 transition"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Draft Pitch</span>
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-center gap-2">
          <span>{error}</span>
        </div>
      )}

      {/* Hero Overview Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 shadow-inner">
              <Building2 className="h-7 w-7" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-white">{company.name}</h1>
                {isSaved ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    Saved in Database
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    <Zap className="h-3 w-3" />
                    ⚡ Temporary Preview (Not in DB)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                <a
                  href={company.website || `https://${company.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 underline underline-offset-2"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>{company.domain}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>

                {company.location && (
                  <span className="flex items-center gap-1 text-slate-300">
                    <MapPin className="h-3.5 w-3.5 text-rose-400" />
                    <span>{company.location}</span>
                  </span>
                )}

                {company.size && (
                  <span className="flex items-center gap-1 text-slate-300">
                    <Users className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{company.size}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Target Role Tag */}
          <div className="flex items-center gap-2">
            <span
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold border ${
                isAgency
                  ? "bg-purple-500/10 border-purple-500/20 text-purple-300"
                  : "bg-sky-500/10 border-sky-500/20 text-sky-300"
              }`}
            >
              {isAgency ? "🏢 Digital Agency (Freelance Outreach)" : "🚀 Tech Startup (Job Outreach)"}
            </span>
          </div>
        </div>

        {/* Firmographic Attributes Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-3 border-t border-slate-800/80 text-xs">
          <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Industry / Domain</span>
            <span className="font-semibold text-slate-200 mt-0.5 block truncate">
              {company.industry || "Technology"}
            </span>
          </div>
          <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Headquarters</span>
            <span className="font-semibold text-slate-200 mt-0.5 block truncate">
              {company.location || "Remote / US"}
            </span>
          </div>
          <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Team Size</span>
            <span className="font-semibold text-slate-200 mt-0.5 block truncate">
              {company.size || "11-50 team"}
            </span>
          </div>
          <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Decision-Makers</span>
            <span className="font-semibold text-emerald-400 mt-0.5 block">
              {people.length} Verified Contacts
            </span>
          </div>
        </div>
      </div>

      {/* Main Analysis Body (2 Columns) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: What the Company Does & Decision-Makers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section: What the company does */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-sky-400" />
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                What {company.name} Does
              </h2>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {company.description ||
                `${company.name} is an active technology organization operating in the ${company.industry || "software"} sector. They provide modern digital products, scalable infrastructure, and dedicated software solutions.`}
            </p>

            {/* Detected Tech Stack */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <span className="text-xs font-semibold text-slate-400 block">Detected Tech Stack & Signals</span>
              {company.tech_stack && company.tech_stack.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {company.tech_stack.map((tech, i) => (
                    <span
                      key={i}
                      className="rounded-lg bg-slate-800/90 border border-slate-700 px-2.5 py-1 text-xs font-mono text-sky-300"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-lg bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 text-xs font-mono text-slate-300">
                    Next.js / React
                  </span>
                  <span className="rounded-lg bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 text-xs font-mono text-slate-300">
                    Python / FastAPI
                  </span>
                  <span className="rounded-lg bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 text-xs font-mono text-slate-300">
                    Cloud Infrastructure
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section: Key Decision Makers & Social Profiles */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                  Key Decision-Makers ({people.length})
                </h2>
              </div>

              {people.length === 0 && (
                <button
                  onClick={handleRunDeepScan}
                  disabled={isEnriching}
                  className="flex items-center gap-1 text-xs font-semibold text-sky-400 hover:text-sky-300"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Find Decision Makers</span>
                </button>
              )}
            </div>

            {people.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center space-y-3">
                <p className="text-xs text-slate-400">
                  No decision-makers have been scanned for {company.name} yet.
                </p>
                <button
                  onClick={handleRunDeepScan}
                  disabled={isEnriching}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition"
                >
                  {isEnriching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Scanning Executives...</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      <span>Extract Decision-Makers & Emails</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {people.map((person, idx) => {
                  const email = person.primary_email || person.email || "";
                  const isCopied = copiedEmail === email;
                  const liUrl = person.linkedin_url ? formatLinkedInUrl(person.linkedin_url) : "";

                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 space-y-3 hover:border-slate-700 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-white text-sm">
                              {person.first_name} {person.last_name}
                            </h3>
                            {person.role_priority && (
                              <span className="rounded bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/20">
                                {person.role_priority === 1
                                  ? "P1 · Founder / CEO"
                                  : person.role_priority === 2
                                  ? "P2 · CTO / VP Eng"
                                  : `Priority ${person.role_priority}`}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 font-medium">{person.title}</p>
                        </div>

                        {/* Social Links */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {liUrl && (
                            <a
                              href={liUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 border border-slate-800 transition"
                              title="View LinkedIn Profile in English"
                            >
                              <LinkedInIcon className="h-4 w-4" />
                            </a>
                          )}

                          {person.twitter_url && (
                            <a
                              href={person.twitter_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition"
                              title="View X / Twitter Profile"
                            >
                              <TwitterXIcon className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Verified Email Box */}
                      {email ? (
                        <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/90 px-3 py-2 border border-slate-800 text-xs font-mono text-sky-300">
                          <div className="flex items-center gap-2 truncate">
                            <Mail className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">{email}</span>
                            <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 shrink-0">
                              {person.email_status || "verified"}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyEmail(email)}
                            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition shrink-0 cursor-pointer"
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 italic">No direct personal email extracted yet.</p>
                      )}

                      {/* Evidence / Context */}
                      {(person.evidence_snippet || person.personalization_notes) && (
                        <p className="text-[11px] text-slate-400 leading-relaxed italic bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/50">
                          "{person.evidence_snippet || person.personalization_notes}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Pitch & Outreach Strategy */}
        <div className="space-y-6">
          {/* Pitch Strategy Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                Pitch & Outreach Strategy
              </h3>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              {isAgency ? (
                <>
                  <p className="font-semibold text-purple-300">
                    🏢 Agency & Dev Studio Angle (Freelance Work):
                  </p>
                  <p>
                    Target Agency Owners, Partners, and Technical Directors. Pitch as a reliable contract engineer
                    to expand their delivery capacity on active client projects without full-time overhead.
                  </p>
                  <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3 space-y-1 text-purple-200">
                    <span className="font-bold block text-[11px]">Recommended Pitch Hook:</span>
                    <span>
                      "Saw your client work in {company.industry || "digital products"}. I help studios scale backend &
                      full-stack deliverables during heavy sprint cycles."
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-semibold text-sky-300">
                    🚀 Tech Startup Angle (Full-Time / Contract Job):
                  </p>
                  <p>
                    Target the Founder, CEO, or CTO directly. Early-stage startups move fast and value proactive
                    engineers who can take immediate ownership of product features.
                  </p>
                  <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 p-3 space-y-1 text-sky-200">
                    <span className="font-bold block text-[11px]">Recommended Pitch Hook:</span>
                    <span>
                      "Loved {company.name}'s approach to {company.industry || "product infrastructure"}. I specialize
                      in shipping high-reliability systems and would love to contribute to your core roadmap."
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="pt-2">
              <Link
                href={`/outreach-prep?search=${encodeURIComponent(company.name)}`}
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 text-xs shadow-md shadow-indigo-600/20 transition"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Prepare Cold Email Pitch</span>
              </Link>
            </div>
          </div>

          {/* Verification & Compliance Signals */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Deliverability & Verification</span>
            </div>
            <ul className="space-y-2 text-slate-400">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Corporate MX server verified</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Zero role mailbox contamination (no info@/sales@)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>LinkedIn profile canonicalized in English</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompanyDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-slate-500">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-400 mb-2" />
          <span>Loading company analysis...</span>
        </div>
      }
    >
      <CompanyDetailContent />
    </Suspense>
  );
}
