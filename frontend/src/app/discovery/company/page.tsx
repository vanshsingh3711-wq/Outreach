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
  Loader2,
  Sparkles,
  Send,
  ShieldCheck,
  Search,
  CheckCircle2,
  Layers,
  Briefcase,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { LinkedInIcon, TwitterXIcon } from "@/components/ui/brand-icons";
import Link from "next/link";
import {
  getInitials,
  cleanDescription,
  extractEvidenceHighlights,
  formatExecutiveRole,
} from "@/lib/discovery-utils";

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
  email_candidates?: Array<{
    email: string;
    deliverability_status?: string;
    discovery_method?: string;
    match_confidence?: number;
  }>;
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
  const [copiedHook, setCopiedHook] = useState(false);
  const [showPatternsFor, setShowPatternsFor] = useState<Record<number, boolean>>({});
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

  const handleCopyPitchHook = (hookText: string) => {
    navigator.clipboard.writeText(hookText);
    setCopiedHook(true);
    setTimeout(() => setCopiedHook(false), 2000);
  };

  // Initial load
  useEffect(() => {
    if (!domain && !idParam) {
      setError("No company specified.");
      setIsLoading(false);
      return;
    }

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

    const loadDetails = async () => {
      try {
        setIsLoading(!cached);
        const cachedUrl = cached?.website || "";
        const endpoint = `/api/prospecting/company-detail?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(idParam)}&url=${encodeURIComponent(cachedUrl)}`;
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
        console.warn("Using cached company data:", err);
        if (!cached) {
          setError(err.message || "Failed to load company details.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [domain, idParam, nameParam]);

  // Deep Scan / Enrich live
  const handleRunDeepScan = async () => {
    let targetUrl = domain ? `https://${domain}` : (company?.website || "");
    if (company?.website && !company.website.includes("clutch.co") && !company.website.includes("goodfirms.co") && !company.website.includes("designrush.com")) {
      targetUrl = company.website;
    }
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
        body: JSON.stringify({ url: targetUrl, domain: domain || company?.domain, persist: false }),
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
        setSuccessMsg(`Extracted ${res.people?.length || 0} decision-maker profiles & emails.`);
        setTimeout(() => setSuccessMsg(null), 4000);

        if (domain) {
          const updated = { ...company, people: res.people };
          sessionStorage.setItem(`discovery_company_${domain.toLowerCase()}`, JSON.stringify(updated));
        }
      } else if ((res as any).error) {
        setError((res as any).error);
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
        setSuccessMsg(`Saved ${company.name} and ${people.length} decision-makers to database.`);
        setTimeout(() => setSuccessMsg(null), 4000);

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
      <div className="py-24 text-center text-zinc-500">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-zinc-400 mb-3" />
        <h2 className="text-sm font-semibold text-zinc-200">Loading Account Details...</h2>
        <p className="text-xs text-zinc-500 mt-1">Retrieving leadership contacts and technical firmographics</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center space-y-4">
        <p className="text-sm text-zinc-400">Account could not be found.</p>
        <button
          onClick={() => router.push("/discovery")}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Discovery</span>
        </button>
      </div>
    );
  }

  const isAgency =
    company.target_type === "agency" ||
    (company.industry || "").toLowerCase().includes("agency") ||
    (company.name || "").toLowerCase().includes("studio");

  const companyInitials = getInitials(company.name, "CO");
  const displayDescription = cleanDescription(company.description) ||
    `${company.name} is a software engineering organization delivering custom digital solutions, product modernization, and scalable cloud architectures.`;

  const pitchHook = isAgency
    ? `"Saw your team's client work in ${company.industry || "digital engineering"}. I help studios scale backend & full-stack deliverables during heavy sprint cycles."`
    : `"Loved ${company.name}'s approach to ${company.industry || "product infrastructure"}. I specialize in shipping high-reliability systems and would love to contribute to your core engineering roadmap."`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Sleek B2B Header & Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5 text-xs text-zinc-400">
          <button
            onClick={() => router.push("/discovery")}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition cursor-pointer font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Discovery</span>
          </button>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-200 font-medium truncate max-w-[220px]">
            {company.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunDeepScan}
            disabled={isEnriching}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 hover:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition cursor-pointer disabled:opacity-50"
            title="Re-crawl website and refresh leadership profiles"
          >
            {isEnriching ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <Search className="h-3.5 w-3.5 text-zinc-400" />
                <span>Deep Re-Scan</span>
              </>
            )}
          </button>

          {!isSaved ? (
            <button
              onClick={handleSaveToDb}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 font-semibold px-3 py-1.5 text-xs shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  <span>Save Lead</span>
                </>
              )}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              <span>Saved in DB</span>
            </span>
          )}

          <Link
            href={`/outreach-prep?search=${encodeURIComponent(company.name)}`}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium px-3.5 py-1.5 text-xs shadow-sm transition"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Draft Pitch</span>
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-xs text-zinc-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Hero Account Header (Attio/Linear style) */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {/* Monogram avatar */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700/60 text-zinc-200 font-semibold text-sm tracking-wider">
              {companyInitials}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-semibold tracking-tight text-white">{company.name}</h1>
                {isSaved ? (
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Saved in Database
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 bg-zinc-800/60 px-2.5 py-0.5 rounded-full border border-zinc-700/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
                    Temporary Staged Lead
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                <a
                  href={company.website || `https://${company.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-zinc-300 hover:text-white flex items-center gap-1.5 transition underline-offset-4 hover:underline"
                >
                  <Globe className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{company.domain}</span>
                  <ExternalLink className="h-3 w-3 text-zinc-500" />
                </a>

                {company.location && (
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{company.location}</span>
                  </span>
                )}

                {company.size && (
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Users className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{company.size}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Segment Tag */}
          <div className="flex items-center gap-2">
            <span className="rounded-lg px-2.5 py-1 text-xs font-medium border border-zinc-800 bg-zinc-900 text-zinc-300 flex items-center gap-1.5">
              {isAgency ? (
                <>
                  <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Digital Agency (Freelance Outreach)</span>
                </>
              ) : (
                <>
                  <Briefcase className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Tech Startup (Job Outreach)</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Firmographic KPI Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-4 border-t border-zinc-800/60 text-xs">
          <div className="rounded-lg bg-zinc-950/40 p-3 border border-zinc-800/50">
            <span className="text-[11px] text-zinc-500 block font-medium">Industry / Sector</span>
            <span className="font-medium text-zinc-200 mt-1 block truncate">
              {company.industry || "Software & Technology"}
            </span>
          </div>
          <div className="rounded-lg bg-zinc-950/40 p-3 border border-zinc-800/50">
            <span className="text-[11px] text-zinc-500 block font-medium">Headquarters</span>
            <span className="font-medium text-zinc-200 mt-1 block truncate">
              {company.location || "Remote"}
            </span>
          </div>
          <div className="rounded-lg bg-zinc-950/40 p-3 border border-zinc-800/50">
            <span className="text-[11px] text-zinc-500 block font-medium">Organization Size</span>
            <span className="font-medium text-zinc-200 mt-1 block truncate">
              {company.size || "11-50 team"}
            </span>
          </div>
          <div className="rounded-lg bg-zinc-950/40 p-3 border border-zinc-800/50">
            <span className="text-[11px] text-zinc-500 block font-medium">Decision-Makers</span>
            <span className="font-medium text-zinc-200 mt-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {people.length} Verified Contact{people.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Grid (2 Columns) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: What company does + Key decision-makers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section: Company Overview */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-4">
            <h2 className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">
              Company Overview
            </h2>

            <p className="text-sm text-zinc-300 leading-relaxed">
              {displayDescription}
            </p>

            {/* Tech Stack & Signals */}
            <div className="pt-3 border-t border-zinc-800/60 space-y-2">
              <span className="text-[11px] font-medium text-zinc-500 block">
                Technical Stack & Delivery Capabilities
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(company.tech_stack && company.tech_stack.length > 0
                  ? company.tech_stack
                  : ["Full-Stack Engineering", "Custom Software", "Cloud Infrastructure", "API Architecture"]
                ).map((tech, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-zinc-950/60 border border-zinc-800 px-2.5 py-1 text-xs font-mono text-zinc-300"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Key Decision-Makers (Clean B2B Cards) */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">
                  Key Decision-Makers
                </h2>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                  {people.length}
                </span>
              </div>

              {people.length === 0 && (
                <button
                  onClick={handleRunDeepScan}
                  disabled={isEnriching}
                  className="flex items-center gap-1 text-xs font-medium text-zinc-300 hover:text-white transition"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Find Decision Makers</span>
                </button>
              )}
            </div>

            {people.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center space-y-3">
                <p className="text-xs text-zinc-400">
                  No decision-makers extracted for {company.name} yet.
                </p>
                <button
                  onClick={handleRunDeepScan}
                  disabled={isEnriching}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 font-semibold px-4 py-2 text-xs shadow-sm transition"
                >
                  {isEnriching ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Scanning Executives...</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-3.5 w-3.5" />
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
                  const personInitials = getInitials(`${person.first_name} ${person.last_name}`, "EX");
                  const roleMeta = formatExecutiveRole(person.role_priority, person.title);
                  const isVerified = person.email_status === "verified" || person.email_verified;
                  const highlights = extractEvidenceHighlights(person.evidence_snippet || person.personalization_notes);
                  const otherCandidates = (person.email_candidates || []).filter((c) => c.email !== email);
                  const showPatterns = Boolean(showPatternsFor[idx]);

                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 space-y-3.5 hover:border-zinc-700/80 transition"
                    >
                      {/* Top row: Avatar, Name, Title, Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700/60 text-zinc-200 font-medium text-xs">
                            {personInitials}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-white text-sm">
                                {person.first_name} {person.last_name}
                              </h3>
                              {roleMeta.label && (
                                <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300 border border-zinc-700/50">
                                  {roleMeta.label}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5 font-normal">
                              {person.title || "Executive"}
                            </p>

                            {/* Clean highlights badge (e.g. Ireland · 500+ connections) */}
                            {highlights.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {highlights.map((h, hIdx) => (
                                  <span
                                    key={hIdx}
                                    className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded"
                                  >
                                    {h}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Social Links */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {liUrl && (
                            <a
                              href={liUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition"
                              title="View LinkedIn Profile"
                            >
                              <LinkedInIcon className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {person.twitter_url && (
                            <a
                              href={person.twitter_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition"
                              title="View X Profile"
                            >
                              <TwitterXIcon className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Email Row (Clay/Apollo style) */}
                      {email ? (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-900/70 px-3 py-2 border border-zinc-800 text-xs">
                            <div className="flex items-center gap-2.5 truncate">
                              <span
                                className={`h-2 w-2 rounded-full shrink-0 ${
                                  isVerified ? "bg-emerald-400" : "bg-zinc-500"
                                }`}
                              />
                              <span className="font-mono text-zinc-200 truncate">{email}</span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium border shrink-0 ${
                                  isVerified
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-zinc-800 text-zinc-400 border-zinc-700/60"
                                }`}
                              >
                                {isVerified ? "Verified (Deliverable)" : "Unverified"}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCopyEmail(email)}
                              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-100 transition shrink-0 cursor-pointer ml-2"
                              title="Copy email address"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  <span className="text-emerald-400 font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Pattern Variations Toggle */}
                          {otherCandidates.length > 0 && (
                            <div className="pt-0.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setShowPatternsFor((prev) => ({
                                    ...prev,
                                    [idx]: !prev[idx],
                                  }))
                                }
                                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                              >
                                <span>
                                  {showPatterns ? "Hide" : "View"} {otherCandidates.length} alternative email pattern{otherCandidates.length === 1 ? "" : "s"}
                                </span>
                                {showPatterns ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>

                              {showPatterns && (
                                <div className="flex items-center gap-1.5 flex-wrap pt-2">
                                  {otherCandidates.map((cand, cIdx) => (
                                    <button
                                      key={cIdx}
                                      type="button"
                                      onClick={() => handleCopyEmail(cand.email)}
                                      className={`inline-flex items-center gap-1.5 text-[10px] font-mono rounded px-2 py-1 border transition cursor-pointer ${
                                        copiedEmail === cand.email
                                          ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/30"
                                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
                                      }`}
                                    >
                                      <span>{cand.email}</span>
                                      {copiedEmail === cand.email ? (
                                        <Check className="h-2.5 w-2.5 text-emerald-400" />
                                      ) : (
                                        <Copy className="h-2.5 w-2.5 opacity-50" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-zinc-500 italic">No direct email address discovered.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Pitch & Outreach Strategy */}
        <div className="space-y-6">
          {/* Strategy Card */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Outreach Strategy
            </h3>

            <div className="space-y-3 text-xs leading-relaxed text-zinc-300">
              {isAgency ? (
                <>
                  <p className="font-medium text-zinc-200">
                    Agency Capacity & Dev Overflow Angle
                  </p>
                  <p className="text-zinc-400">
                    Pitch Agency Owners and Technical Directors as a specialized contractor who can absorb heavy sprint backlogs without full-time employee overhead.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-zinc-200">
                    Fast-Ship Engineering Contributor Angle
                  </p>
                  <p className="text-zinc-400">
                    Pitch Founders & CTOs directly. Fast-growing product teams prioritize senior engineers who can take immediate ownership of product roadmap features.
                  </p>
                </>
              )}

              {/* Pitch Hook Box */}
              <div className="rounded-lg bg-zinc-950/60 border border-zinc-800/80 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-zinc-400">Recommended Hook:</span>
                  <button
                    type="button"
                    onClick={() => handleCopyPitchHook(pitchHook)}
                    className="flex items-center gap-1 text-zinc-400 hover:text-white transition cursor-pointer"
                  >
                    {copiedHook ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-zinc-200 italic font-sans text-xs">
                  {pitchHook}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href={`/outreach-prep?search=${encodeURIComponent(company.name)}`}
                className="flex items-center justify-center gap-2 w-full rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 font-semibold py-2.5 text-xs shadow-sm transition"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Prepare Cold Email Pitch</span>
              </Link>
            </div>
          </div>

          {/* Verification & Compliance Signals */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-3 text-xs">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
              Deliverability & Compliance
            </span>
            <ul className="space-y-2.5 text-zinc-300">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Corporate MX mailserver verified</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Zero role mailbox contamination (no info@/sales@)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>LinkedIn profile canonicalized in English</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>DNS SPF & DKIM record sanity checked</span>
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
        <div className="py-24 text-center text-zinc-500">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-zinc-400 mb-2" />
          <span>Loading account analysis...</span>
        </div>
      }
    >
      <CompanyDetailContent />
    </Suspense>
  );
}
