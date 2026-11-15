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
  Target,
  Send,
  Zap,
  BookmarkPlus,
  Save,
  X,
  FileText,
} from "lucide-react";
import { LinkedInIcon, TwitterXIcon } from "@/components/ui/brand-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  size?: string;
  revenue?: string;
  target_type?: string;
  description?: string;
  snippet?: string;
  contact_count?: number;
  fit_score?: number;
  signals?: string[];
  people?: DecisionMakerPreview[];
  is_existing?: boolean;
}

export default function DiscoveryPage() {
  // Primary targeting intent: "startup" (job outreach), "agency" (freelance work), or "all"
  const [targetType, setTargetType] = useState<"startup" | "agency" | "all">("startup");

  // User requested filters
  const [companySize, setCompanySize] = useState("11-50");
  const [location, setLocation] = useState("United States, Remote");
  const [revenueTier, setRevenueTier] = useState("");
  const [businessDomain, setBusinessDomain] = useState("Fintech, Healthcare, Cybersecurity, B2B SaaS");
  const [customQuery, setCustomQuery] = useState("");

  const [autoEnrich, setAutoEnrich] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiscoveredCompany[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Per-company action states
  const [enrichingDomain, setEnrichingDomain] = useState<string | null>(null);
  const [savingDomain, setSavingDomain] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "saved" | "temporary" | "with_leads">("all");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const router = useRouter();

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleViewDetails = (c: DiscoveredCompany) => {
    try {
      sessionStorage.setItem(`discovery_company_${c.domain.toLowerCase()}`, JSON.stringify(c));
    } catch (err) {
      console.warn("sessionStorage save error:", err);
    }
    router.push(`/discovery/company?domain=${encodeURIComponent(c.domain)}&name=${encodeURIComponent(c.name)}`);
  };

  // Quick preset pills for real business domains (Fintech, Health, Security, SaaS, etc.)
  const LOCATION_PRESETS = ["Remote", "United States", "Europe", "United Kingdom", "India", "Canada"];
  const DOMAIN_PRESETS = [
    "Cybersecurity",
    "Fintech",
    "Healthcare",
    "B2B SaaS",
    "AI",
    "Developer Tools",
    "E-commerce",
    "EdTech",
  ];

  // Load permanently saved companies and their decision-makers on mount
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
        const isAgency =
          (c.name || "").toLowerCase().includes("agency") ||
          (c.name || "").toLowerCase().includes("studio") ||
          (c.description || "").toLowerCase().includes("agency") ||
          (c.industry || "").toLowerCase().includes("agency");

        return {
          id: c.id,
          company_id: c.id,
          name: c.name || c.domain,
          domain: c.domain,
          website: c.website || `https://${c.domain}`,
          industry: c.industry || (isAgency ? "Agency" : "Tech Startup"),
          location: c.location,
          size: c.size,
          target_type: isAgency ? "agency" : "startup",
          description: c.description || c.notes,
          contact_count: attachedPeople.length || c.contact_count || 0,
          people: attachedPeople,
          fit_score: c.fit,
          is_existing: true, // Permanent DB record
        };
      });

      // Preserve any temporary unsaved results the user currently has open
      setResults((prev) => {
        const existingDomains = new Set(mapped.map((m) => m.domain.toLowerCase()));
        const temporary = prev.filter((p) => !p.is_existing && !existingDomains.has(p.domain.toLowerCase()));
        return [...temporary, ...mapped];
      });
    } catch (err) {
      console.error("Failed to load saved accounts:", err);
    } finally {
      setIsLoadingExisting(false);
    }
  };

  useEffect(() => {
    loadSavedAccounts();
  }, []);

  // Run discovery: produces temporary staged results without saving to DB automatically
  const handleRunDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const domains = businessDomain.split(",").map((s) => s.trim()).filter(Boolean);
      const payload = {
        target_type: targetType,
        company_size_tier: companySize,
        revenue_tier: revenueTier,
        locations: location.split(",").map((s) => s.trim()).filter(Boolean),
        industries: domains,
        tech_stack: [],
        custom_query: customQuery.trim(),
        limit: 12,
        auto_enrich: autoEnrich,
        save_to_db: false, // DO NOT save to database automatically
      };

      const res = await fetchApi<{ success: boolean; count: number; companies: any[] }>(
        "/api/prospecting/discover",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      const incoming: DiscoveredCompany[] = (res.companies || []).map((c) => ({
        id: c.company_id || c.id,
        company_id: c.company_id || c.id,
        name: c.name,
        domain: c.domain,
        website: c.website,
        description: c.description || c.snippet,
        industry: c.industry,
        location: c.location || location,
        size: c.size || companySize,
        target_type: c.target_type || targetType,
        contact_count: c.contact_count || (c.people ? c.people.length : 0),
        people: c.people || [],
        is_existing: Boolean(c.is_existing),
      }));

      // Merge new temporary results with existing, keeping unique domains
      setResults((prev) => {
        const existingDomains = new Set(prev.map((p) => p.domain.toLowerCase()));
        const fresh = incoming.filter((item) => !existingDomains.has(item.domain.toLowerCase()));
        return [...fresh, ...prev];
      });

      setSuccessMsg(
        `Discovered ${res.count || incoming.length} leads! They are staged temporarily below. Click "Save to DB" on any lead you want to permanently keep.`
      );
    } catch (err: any) {
      setError(err.message || "Failed to run discovery.");
    } finally {
      setIsRunning(false);
    }
  };

  // Enrich temporary candidate in-memory (persist=false)
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
        body: JSON.stringify({ url: targetUrl, persist: false }),
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
          `Extracted ${res.people.length} real decision-maker(s) for ${company.name}! Review below and click "Save to DB" to keep them.`
        );
      }
    } catch (err: any) {
      setError(`Failed to enrich ${company.name}: ${err.message}`);
    } finally {
      setEnrichingDomain(null);
    }
  };

  // Explicitly save a single lead permanently to the database
  const handleSaveLead = async (company: DiscoveredCompany) => {
    setSavingDomain(company.domain);
    setError(null);

    try {
      const res = await fetchApi<{ success: boolean; company_id: string; saved_prospects: number }>(
        "/api/prospecting/save-lead",
        {
          method: "POST",
          body: JSON.stringify({
            name: company.name,
            domain: company.domain,
            website: company.website,
            description: company.description,
            industry: company.industry,
            location: company.location,
            size: company.size,
            people: company.people || [],
          }),
        }
      );

      if (res.success) {
        setResults((prev) =>
          prev.map((c) =>
            c.domain.toLowerCase() === company.domain.toLowerCase()
              ? { ...c, is_existing: true, company_id: res.company_id }
              : c
          )
        );
        setSuccessMsg(`✓ Saved ${company.name} and ${res.saved_prospects || 0} decision-maker(s) permanently to database.`);
      }
    } catch (err: any) {
      setError(`Failed to save ${company.name}: ${err.message}`);
    } finally {
      setSavingDomain(null);
    }
  };

  // Batch save all currently unsaved temporary leads to database
  const handleSaveAllUnsaved = async () => {
    const unsaved = results.filter((c) => !c.is_existing);
    if (unsaved.length === 0) return;

    setIsSavingAll(true);
    setError(null);

    try {
      const res = await fetchApi<{ success: boolean; companies_saved: number; leads_saved: number }>(
        "/api/prospecting/save-leads-batch",
        {
          method: "POST",
          body: JSON.stringify({ companies: unsaved }),
        }
      );

      if (res.success) {
        setResults((prev) => prev.map((c) => ({ ...c, is_existing: true })));
        setSuccessMsg(`✓ Successfully saved ${res.companies_saved} companies and ${res.leads_saved} leads permanently to database!`);
      }
    } catch (err: any) {
      setError(`Failed to batch save: ${err.message}`);
    } finally {
      setIsSavingAll(false);
    }
  };

  // Dismiss a temporary lead from the session
  const handleDismissCompany = (domain: string) => {
    setResults((prev) => prev.filter((c) => c.domain.toLowerCase() !== domain.toLowerCase()));
  };

  // Filter accounts in the list
  const filteredResults = results.filter((c) => {
    const matchesSearch =
      !searchFilter ||
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.domain.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (c.industry && c.industry.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (c.location && c.location.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (c.people && c.people.some((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchFilter.toLowerCase())));

    if (!matchesSearch) return false;

    if (activeTab === "saved") {
      return Boolean(c.is_existing);
    }
    if (activeTab === "temporary") {
      return !c.is_existing;
    }
    if (activeTab === "with_leads") {
      return (c.contact_count || 0) > 0 || (c.people && c.people.length > 0);
    }
    return true;
  });

  const savedCount = results.filter((c) => c.is_existing).length;
  const unsavedCount = results.filter((c) => !c.is_existing).length;
  const totalWithLeads = results.filter((c) => (c.contact_count || 0) > 0 || (c.people && c.people.length > 0)).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Direct Company & Lead Discovery</h1>
            <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 border border-sky-500/20">
              Job & Freelance Outreach
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Find tech startups and agencies. Review staged results temporarily and save only the leads you want to keep permanently.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs">
            <Database className="h-4 w-4 text-emerald-400" />
            <span className="text-slate-300 font-medium">{savedCount} Saved in DB</span>
          </div>

          {unsavedCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs">
              <Zap className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 font-medium">{unsavedCount} Temporary</span>
            </div>
          )}

          {unsavedCount > 0 && (
            <button
              onClick={handleSaveAllUnsaved}
              disabled={isSavingAll}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/30 transition cursor-pointer font-semibold disabled:opacity-50"
            >
              {isSavingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>Save All ({unsavedCount}) to DB</span>
            </button>
          )}

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
        className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm space-y-5"
      >
        {/* 1. Primary Target Intent Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Target Focus: What are you looking to find?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setTargetType("startup");
                if (companySize === "") setCompanySize("11-50");
              }}
              className={`flex flex-col text-left p-3.5 rounded-xl border transition cursor-pointer ${
                targetType === "startup"
                  ? "bg-sky-500/15 border-sky-500 text-white shadow-md shadow-sky-500/10"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" />
                  Tech Startups
                </span>
                <span className="text-[10px] font-semibold bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full">
                  For Job
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">
                Discover SaaS & product startups to cold email Founders, CTOs, and Engineering Leads for jobs.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetType("agency");
                if (companySize === "") setCompanySize("1-10");
              }}
              className={`flex flex-col text-left p-3.5 rounded-xl border transition cursor-pointer ${
                targetType === "agency"
                  ? "bg-purple-500/15 border-purple-500 text-white shadow-md shadow-purple-500/10"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  Agencies & Dev Studios
                </span>
                <span className="text-[10px] font-semibold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                  For Freelance
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">
                Discover digital agencies and custom dev consultancies to pitch Agency Owners & Partners for freelance work.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setTargetType("all")}
              className={`flex flex-col text-left p-3.5 rounded-xl border transition cursor-pointer ${
                targetType === "all"
                  ? "bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Target className="h-4 w-4" />
                  Both (Startups & Agencies)
                </span>
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                  Combined
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">
                Discover high-fit candidates across both fast-growing tech companies and dev studios.
              </p>
            </button>
          </div>
        </div>

        {/* 2. Primary 4 Filters Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-1">
          {/* Company / Agency Size */}
          <div>
            <label className="block text-xs font-medium text-slate-300">
              {targetType === "agency" ? "Agency Size" : "Company / Team Size"}
            </label>
            <select
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="">Any Size</option>
              <option value="1-10">1 - 10 (Early / Boutique Studio)</option>
              <option value="11-50">11 - 50 (Small Studio / Seed Startup)</option>
              <option value="51-200">51 - 200 (Mid-sized / Established)</option>
              <option value="200+">200+ (Scaleup / Enterprise)</option>
            </select>
          </div>

          {/* Location / Headquarters */}
          <div>
            <label className="block text-xs font-medium text-slate-300">Headquarters / Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. United States, Remote"
              className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {LOCATION_PRESETS.slice(0, 4).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLocation(preset)}
                  className="text-[10px] text-slate-400 hover:text-sky-300 transition cursor-pointer"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>

          {/* Revenue / Funding (Optional) */}
          <div>
            <label className="block text-xs font-medium text-slate-300">
              Revenue / Funding <span className="text-slate-500">(Optional)</span>
            </label>
            <select
              value={revenueTier}
              onChange={(e) => setRevenueTier(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="">Any Revenue / Stage</option>
              <option value="Bootstrapped">Bootstrapped / Profitable</option>
              <option value="Seed">Pre-Seed / Seed Funded</option>
              <option value="Series A">Series A+ High Growth</option>
              <option value="< $1M ARR">&lt; $1M ARR</option>
              <option value="$1M - $10M ARR">$1M - $10M ARR</option>
            </select>
          </div>

          {/* Business Domain / Industry */}
          <div>
            <label className="block text-xs font-medium text-slate-300">
              Business Domain / Industry
            </label>
            <input
              type="text"
              value={businessDomain}
              onChange={(e) => setBusinessDomain(e.target.value)}
              placeholder="e.g. Fintech, Healthcare, Cybersecurity, B2B SaaS"
              className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {DOMAIN_PRESETS.slice(0, 4).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    const current = businessDomain.split(",").map((s) => s.trim()).filter(Boolean);
                    if (!current.includes(preset)) {
                      setBusinessDomain(current.length > 0 ? `${businessDomain}, ${preset}` : preset);
                    }
                  }}
                  className="text-[10px] text-slate-400 hover:text-sky-300 transition cursor-pointer"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Business Domain Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-slate-400 font-medium text-[11px]">Popular Domains:</span>
          {DOMAIN_PRESETS.map((domain) => {
            const isSelected = businessDomain.toLowerCase().includes(domain.toLowerCase());
            return (
              <button
                key={domain}
                type="button"
                onClick={() => {
                  const current = businessDomain.split(",").map((s) => s.trim()).filter(Boolean);
                  if (isSelected) {
                    const next = current.filter((s) => s.toLowerCase() !== domain.toLowerCase());
                    setBusinessDomain(next.join(", "));
                  } else {
                    setBusinessDomain([...current, domain].join(", "));
                  }
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer border ${
                  isSelected
                    ? "bg-sky-500/15 border-sky-500 text-sky-300 shadow-sm shadow-sky-500/10"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                {isSelected ? `✓ ${domain}` : `+ ${domain}`}
              </button>
            );
          })}
        </div>

        {/* 3. Anti-Job-Listing Guarantee Banner */}
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 flex items-start gap-3 text-xs text-slate-300">
          <ShieldCheck className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-sky-300">Temporary Staging Discovery</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Discovered results are kept in memory for review. Only the leads you explicitly click <strong>"Save to DB"</strong> will be written permanently to your database.
            </p>
          </div>
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

        {/* 4. Controls & Submit */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
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
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-sky-500/25 hover:opacity-95 transition cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Searching & Staging...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>
                  {targetType === "agency"
                    ? "Find Agencies for Freelance"
                    : targetType === "startup"
                    ? "Find Startups for Jobs"
                    : "Discover Startups & Agencies"}
                </span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Discovered Accounts Controls & Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "all"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              All Results ({results.length})
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "saved"
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              ✓ Saved in DB ({savedCount})
            </button>
            <button
              onClick={() => setActiveTab("temporary")}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "temporary"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              ⚡ Temporary ({unsavedCount})
            </button>
            <button
              onClick={() => setActiveTab("with_leads")}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "with_leads"
                  ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              With Leads ({totalWithLeads})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search companies, domains, leads..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Loading skeleton or empty state */}
        {isLoadingExisting && results.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center text-slate-500 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
            <span>Loading accounts...</span>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center text-slate-500">
            {searchFilter ? "No companies matched your search filter." : 'No accounts found yet. Adjust criteria above and click search.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredResults.map((c) => {
              const hasLeads = (c.people && c.people.length > 0) || (c.contact_count || 0) > 0;
              const isEnrichingThis = enrichingDomain === c.domain;
              const isSavingThis = savingDomain === c.domain;
              const isAgency = c.target_type === "agency" || (c.name || "").toLowerCase().includes("agency");

              return (
                <div
                  key={c.id || c.domain}
                  className={`rounded-2xl border p-5 shadow-sm transition flex flex-col justify-between ${
                    c.is_existing
                      ? "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                      : "border-amber-500/20 bg-slate-900/40 hover:border-amber-500/40"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            isAgency ? "bg-purple-500/10 text-purple-400" : "bg-sky-500/10 text-sky-400"
                          }`}
                        >
                          {isAgency ? <Building2 className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
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

                      <div className="flex flex-col items-end gap-1.5">
                        {c.is_existing ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                            <Check className="h-2.5 w-2.5" />
                            Saved in DB
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                              <Zap className="h-2.5 w-2.5" />
                              Temporary
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDismissCompany(c.domain)}
                              className="text-slate-500 hover:text-rose-400 p-0.5 rounded cursor-pointer transition"
                              title="Dismiss from temporary view"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {c.fit_score ? (
                          <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-400 border border-sky-500/20">
                            {c.fit_score}% Fit
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Target Intent & Firmographics Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span
                        className={`rounded-lg px-2 py-0.5 font-medium ${
                          isAgency
                            ? "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                            : "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                        }`}
                      >
                        {isAgency ? "🏢 Agency (Freelance)" : "🚀 Tech Startup (Job)"}
                      </span>
                      {c.size && (
                        <span className="rounded-lg bg-slate-800/60 px-2 py-0.5 text-slate-300">
                          👥 {c.size} team
                        </span>
                      )}
                      <span className="rounded-lg bg-slate-800/60 px-2 py-0.5 text-slate-400">
                        📍 {c.location || "Remote / US"}
                      </span>
                      {c.industry && c.industry !== (isAgency ? "Agency" : "Tech Startup") && (
                        <span className="rounded-lg bg-slate-800/60 px-2 py-0.5 text-slate-400">
                          {c.industry}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {c.description && (
                      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {c.description}
                      </p>
                    )}

                    {/* Verified Decision Makers Section */}
                    {c.people && c.people.length > 0 ? (
                      <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-2 mt-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 border-b border-slate-800/60 pb-1.5">
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Verified Decision-Makers ({c.people.length})
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {c.is_existing ? "Saved in DB" : "Staged (Unsaved)"}
                          </span>
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
                              +{c.people.length - 2} more decision-makers found
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-2.5 flex items-center justify-between gap-2 mt-2">
                        <span className="text-[11px] text-slate-400">
                          Decision-makers ready to extract
                        </span>
                        <button
                          type="button"
                          onClick={() => handleEnrichCompany(c)}
                          disabled={isEnrichingThis}
                          className="flex items-center gap-1 rounded-lg bg-sky-500/10 border border-sky-500/30 px-2 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20 transition cursor-pointer disabled:opacity-50"
                        >
                          {isEnrichingThis ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Scanning...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3 w-3 text-sky-400" />
                              <span>Find Decision-Makers</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    {/* View Details Button */}
                    <button
                      type="button"
                      onClick={() => handleViewDetails(c)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 text-xs transition cursor-pointer"
                      title="Open full company analysis & decision-maker profiles"
                    >
                      <FileText className="h-3.5 w-3.5 text-sky-400" />
                      <span>View Details</span>
                    </button>

                    {/* Right button: Save to DB or Saved Indicator */}
                    {!c.is_existing ? (
                      <button
                        type="button"
                        onClick={() => handleSaveLead(c)}
                        disabled={isSavingThis}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
                        title="Permanently save this company & leads to database"
                      >
                        {isSavingThis ? (
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
                      <Link
                        href={`/decision-makers?search=${encodeURIComponent(c.name)}`}
                        className="text-xs text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 font-medium"
                        title="Saved in database - view in pipeline"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Saved in DB</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
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
