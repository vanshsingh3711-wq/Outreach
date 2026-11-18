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
  Database,
  Mail,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Briefcase,
  ShieldCheck,
  Target,
  Zap,
  BookmarkPlus,
  Save,
  X,
  FileText,
  Rocket,
  Code2,
  Terminal,
  Palette,
  Star,
  Compass,
  MapPin,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { LinkedInIcon } from "@/components/ui/brand-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getInitials,
  cleanDescription,
} from "@/lib/discovery-utils";

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
  source_platform?: string;
  description?: string;
  snippet?: string;
  contact_count?: number;
  fit_score?: number;
  signals?: string[];
  people?: DecisionMakerPreview[];
  is_existing?: boolean;
}

interface PlatformOption {
  id: string;
  label: string;
  icon: React.ElementType;
  desc: string;
  badge?: string;
}

const STARTUP_PLATFORMS: PlatformOption[] = [
  { id: "yc", label: "Y Combinator", icon: Rocket, desc: "Funded tech companies hiring devs", badge: "Verified" },
  { id: "wellfound", label: "Wellfound (AngelList)", icon: Target, desc: "Seed to Series A tech startups", badge: "Hiring" },
  { id: "hackernews", label: "Hacker News (HN)", icon: Terminal, desc: "Who's Hiring monthly posts", badge: "Direct" },
  { id: "ashby", label: "Ashby & Lever ATS", icon: Briefcase, desc: "Live engineering job feeds", badge: "Active" },
  { id: "producthunt", label: "Product Hunt", icon: Sparkles, desc: "Daily new software product launches", badge: "New" },
  { id: "eustartups", label: "EU-Startups", icon: Globe, desc: "European funded ventures", badge: "Europe" },
  { id: "peerlist", label: "Peerlist", icon: Users, desc: "Remote-first tech projects", badge: "Global" },
  { id: "all", label: "Global Startup Web", icon: Compass, desc: "Broad unfiltered keyword search", badge: "Open" },
];

const AGENCY_PLATFORMS: PlatformOption[] = [
  { id: "clutch", label: "Clutch.co", icon: Building2, desc: "Top verified dev shops & digital agencies", badge: "Top Agencies" },
  { id: "goodfirms", label: "GoodFirms", icon: Star, desc: "Software & web development studios", badge: "Verified" },
  { id: "designrush", label: "DesignRush", icon: Palette, desc: "B2B web design & engineering studios", badge: "B2B Hub" },
  { id: "manifest", label: "The Manifest", icon: FileText, desc: "Shortlisted dev agencies & tech studios", badge: "Ranked" },
  { id: "hn_freelance", label: "HN: Freelancer", icon: Terminal, desc: "Monthly contract & freelance hiring", badge: "Direct" },
  { id: "agencyspotter", label: "Agency Spotter", icon: Compass, desc: "Digital & software development directory", badge: "Directory" },
  { id: "upwork_agencies", label: "Upwork Agencies", icon: Briefcase, desc: "Dev agencies seeking delivery bandwidth", badge: "Overflow" },
  { id: "all", label: "Global Agency Web", icon: Globe, desc: "Direct agency websites & custom studios", badge: "Direct" },
];

const COMBINED_PLATFORMS: PlatformOption[] = [
  { id: "clutch", label: "Clutch.co", icon: Building2, desc: "Top dev shops & digital studios", badge: "Agencies" },
  { id: "yc", label: "Y Combinator", icon: Rocket, desc: "Funded tech startups hiring devs", badge: "Startups" },
  { id: "goodfirms", label: "GoodFirms", icon: Star, desc: "Software & web development firms", badge: "Agencies" },
  { id: "wellfound", label: "Wellfound", icon: Target, desc: "Seed to Series A startups", badge: "Startups" },
  { id: "hn_freelance", label: "HN Freelance", icon: Terminal, desc: "Monthly contract dev postings", badge: "Contracts" },
  { id: "designrush", label: "DesignRush", icon: Palette, desc: "B2B engineering & design studios", badge: "Agencies" },
  { id: "ashby", label: "Ashby / Lever", icon: Briefcase, desc: "Live job boards and startup teams", badge: "Startups" },
  { id: "all", label: "Global Web (All)", icon: Compass, desc: "Startups and dev studios globally", badge: "Open" },
];

export default function DiscoveryPage() {
  const [targetType, setTargetType] = useState<"startup" | "agency" | "all">("agency");
  const [sourcePlatform, setSourcePlatform] = useState<string>("clutch");

  const [companySize, setCompanySize] = useState("11-50");
  const [location, setLocation] = useState("Remote, Europe, United States");
  const [revenueTier, setRevenueTier] = useState("");
  const [businessDomain, setBusinessDomain] = useState("Fintech, Healthcare, Cybersecurity, B2B SaaS");
  const [customQuery, setCustomQuery] = useState("");

  const [autoEnrich, setAutoEnrich] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiscoveredCompany[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  const LOCATION_PRESETS = ["Remote", "Europe", "United States", "United Kingdom", "Canada", "Global"];
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
          is_existing: true,
        };
      });

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

  const handleRunDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const domains = businessDomain.split(",").map((s) => s.trim()).filter(Boolean);
      const payload = {
        target_type: targetType,
        source_platform: sourcePlatform,
        company_size_tier: companySize,
        revenue_tier: revenueTier,
        locations: location.split(",").map((s) => s.trim()).filter(Boolean),
        industries: domains,
        tech_stack: [],
        custom_query: customQuery.trim(),
        limit: 12,
        auto_enrich: autoEnrich,
        save_to_db: false,
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
        source_platform: c.source_platform || "Global Web",
        contact_count: c.contact_count || (c.people ? c.people.length : 0),
        people: c.people || [],
        is_existing: Boolean(c.is_existing),
      }));

      setResults((prev) => {
        const existingDomains = new Set(prev.map((p) => p.domain.toLowerCase()));
        const fresh = incoming.filter((item) => !existingDomains.has(item.domain.toLowerCase()));
        return [...fresh, ...prev];
      });

      setSuccessMsg(
        `Discovered ${res.count || incoming.length} accounts. Staged in temporary preview below.`
      );
    } catch (err: any) {
      setError(err.message || "Failed to run discovery.");
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
        body: JSON.stringify({ url: targetUrl, domain: company.domain, persist: false }),
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
          `Extracted ${res.people.length} decision-maker profile(s) for ${company.name}.`
        );
      }
    } catch (err: any) {
      setError(`Failed to enrich ${company.name}: ${err.message}`);
    } finally {
      setEnrichingDomain(null);
    }
  };

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
        setSuccessMsg(`Saved ${company.name} permanently to database.`);
      }
    } catch (err: any) {
      setError(`Failed to save ${company.name}: ${err.message}`);
    } finally {
      setSavingDomain(null);
    }
  };

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
        setSuccessMsg(`Saved ${res.companies_saved} companies and ${res.leads_saved} leads to database.`);
      }
    } catch (err: any) {
      setError(`Failed to batch save: ${err.message}`);
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleDismissCompany = (domain: string) => {
    setResults((prev) => prev.filter((c) => c.domain.toLowerCase() !== domain.toLowerCase()));
  };

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

  const currentPlatformList =
    targetType === "agency"
      ? AGENCY_PLATFORMS
      : targetType === "startup"
      ? STARTUP_PLATFORMS
      : COMBINED_PLATFORMS;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">ICP Prospect Discovery</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Source verified companies and decision-maker emails across job boards, directories, and search rankings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="font-medium">{savedCount} Saved</span>
          </div>

          {unsavedCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>{unsavedCount} Staged</span>
            </div>
          )}

          {unsavedCount > 0 && (
            <button
              onClick={handleSaveAllUnsaved}
              disabled={isSavingAll}
              className="flex items-center gap-1.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-semibold px-3 py-1.5 text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {isSavingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>Save All ({unsavedCount})</span>
            </button>
          )}

          <button
            onClick={loadSavedAccounts}
            disabled={isLoadingExisting}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted px-2.5 py-1.5 text-xs text-foreground transition cursor-pointer"
            title="Refresh accounts from database"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isLoadingExisting ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 2. Sleek Filter Card */}
      <form
        onSubmit={handleRunDiscovery}
        className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-5"
      >
        {/* Target Intent Segmented Switcher */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2">
            Target Focus
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setTargetType("agency");
                if (companySize === "") setCompanySize("11-50");
                if (["yc", "wellfound", "hackernews", "ashby", "producthunt", "eustartups", "peerlist"].includes(sourcePlatform)) {
                  setSourcePlatform("clutch");
                }
              }}
              className={`flex items-start gap-3 p-3 rounded-lg border text-left transition cursor-pointer ${
                targetType === "agency"
                  ? "bg-zinc-800/90 border-zinc-700 text-white shadow-sm"
                  : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              <div className="p-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 shrink-0">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-200">Agencies & Dev Studios</span>
                  <span className="text-[10px] font-medium text-zinc-400 bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
                    Freelance
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                  Pitch agency founders & partners for contract dev work and team overflow.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetType("startup");
                if (["clutch", "goodfirms", "designrush", "manifest", "hn_freelance", "agencyspotter", "upwork_agencies"].includes(sourcePlatform)) {
                  setSourcePlatform("yc");
                }
              }}
              className={`flex items-start gap-3 p-3 rounded-lg border text-left transition cursor-pointer ${
                targetType === "startup"
                  ? "bg-zinc-800/90 border-zinc-700 text-white shadow-sm"
                  : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              <div className="p-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 shrink-0">
                <Rocket className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-200">Tech Startups</span>
                  <span className="text-[10px] font-medium text-zinc-400 bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
                    Job Outreach
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                  Target seed to Series A software companies to cold pitch Founders and CTOs.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTargetType("all")}
              className={`flex items-start gap-3 p-3 rounded-lg border text-left transition cursor-pointer ${
                targetType === "all"
                  ? "bg-zinc-800/90 border-zinc-700 text-white shadow-sm"
                  : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              <div className="p-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 shrink-0">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-200">Combined Pipeline</span>
                  <span className="text-[10px] font-medium text-zinc-400 bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
                    All
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                  Source from both high-growth tech ventures and specialized software agencies.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Source Platform Grid (Clean SVG Icons, Zero Emojis) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-zinc-400">
              Source Directory / Platform
            </label>
            <span className="text-[11px] text-zinc-500">
              Select verified source directory
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {currentPlatformList.map((plat) => {
              const isSelected = sourcePlatform === plat.id;
              const IconComp = plat.icon;
              return (
                <button
                  key={plat.id}
                  type="button"
                  onClick={() => setSourcePlatform(plat.id)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    isSelected
                      ? "bg-zinc-800/80 border-zinc-600 text-white shadow-sm"
                      : "bg-zinc-950/40 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  <div
                    className={`p-1.5 rounded shrink-0 mt-0.5 ${
                      isSelected ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-500"
                    }`}
                  >
                    <IconComp className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium truncate text-zinc-200">
                        {plat.label}
                      </span>
                      {plat.badge && (
                        <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                          {plat.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                      {plat.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-1">
          <div>
            <label className="block text-xs font-medium text-zinc-400">
              {targetType === "agency" ? "Agency Size" : "Team Size"}
            </label>
            <select
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
            >
              <option value="">Any Size</option>
              <option value="1-10">1 - 10 (Boutique Studio / Seed)</option>
              <option value="11-50">11 - 50 (Small Studio / Series A)</option>
              <option value="51-200">51 - 200 (Mid-sized / Established)</option>
              <option value="200+">200+ (Scaleup / Enterprise)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">Location / Headquarters</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Remote, United States, Europe"
              className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {LOCATION_PRESETS.slice(0, 4).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLocation(preset)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">
              Revenue / Stage <span className="text-zinc-600">(Optional)</span>
            </label>
            <select
              value={revenueTier}
              onChange={(e) => setRevenueTier(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
            >
              <option value="">Any Stage</option>
              <option value="Bootstrapped">Bootstrapped / Profitable</option>
              <option value="Seed">Pre-Seed / Seed Funded</option>
              <option value="Series A">Series A+ Growth</option>
              <option value="< $1M ARR">&lt; $1M ARR</option>
              <option value="$1M - $10M ARR">$1M - $10M ARR</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">
              Industry Domain
            </label>
            <input
              type="text"
              value={businessDomain}
              onChange={(e) => setBusinessDomain(e.target.value)}
              placeholder="e.g. Fintech, Healthcare, B2B SaaS"
              className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
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
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Popular Domain Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-zinc-500 font-medium text-[11px] mr-1">Popular:</span>
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
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition cursor-pointer border ${
                  isSelected
                    ? "bg-zinc-800 border-zinc-600 text-zinc-100"
                    : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                {isSelected ? `✓ ${domain}` : `+ ${domain}`}
              </button>
            );
          })}
        </div>

        {/* Staging Info Note (Subdued, Non-intrusive) */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3.5 py-2.5 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-zinc-400 shrink-0" />
            <span>
              Discovered leads are staged in temporary preview. Click <strong>"Save to DB"</strong> on any account to save it permanently.
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-xs text-zinc-300 flex items-center justify-between">
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

        {successMsg && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Controls Bar & Submit */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none hover:text-zinc-200 transition">
            <input
              type="checkbox"
              checked={autoEnrich}
              onChange={(e) => setAutoEnrich(e.target.checked)}
              className="rounded border-zinc-800 bg-zinc-950 text-blue-500 focus:ring-0"
            />
            <span>Auto-crawl website & extract decision-makers during discovery</span>
          </label>
          <button
            type="submit"
            disabled={isRunning}
            className="flex items-center justify-center gap-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 font-semibold px-5 py-2 text-xs shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Searching Directory...</span>
              </>
            ) : (
              <>
                <Search className="h-3.5 w-3.5" />
                <span>
                  {targetType === "agency"
                    ? "Find Agencies"
                    : targetType === "startup"
                    ? "Find Startups"
                    : "Discover Accounts"}
                </span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* 3. Discovered Results Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "all"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              All Results ({results.length})
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "saved"
                  ? "bg-zinc-800 text-emerald-400"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              Saved ({savedCount})
            </button>
            <button
              onClick={() => setActiveTab("temporary")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "temporary"
                  ? "bg-zinc-800 text-zinc-200"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              Staged ({unsavedCount})
            </button>
            <button
              onClick={() => setActiveTab("with_leads")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "with_leads"
                  ? "bg-zinc-800 text-blue-400"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              With Leads ({totalWithLeads})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by company, domain, lead..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Loading / Empty States */}
        {isLoadingExisting && results.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center text-zinc-500 flex flex-col items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            <span className="text-xs">Loading accounts...</span>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center text-zinc-500 text-xs">
            {searchFilter ? "No companies matched your filter." : 'No accounts found yet. Adjust criteria above and click search.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredResults.map((c) => {
              const isEnrichingThis = enrichingDomain === c.domain;
              const isSavingThis = savingDomain === c.domain;
              const isAgency = c.target_type === "agency" || (c.name || "").toLowerCase().includes("agency");
              const initials = getInitials(c.name, "CO");
              const cleanedDesc = cleanDescription(c.description);

              return (
                <div
                  key={c.id || c.domain}
                  className={`rounded-xl border p-4 shadow-sm transition flex flex-col justify-between ${
                    c.is_existing
                      ? "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                      : "border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Company Monogram */}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-200 font-medium text-xs">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-zinc-100 text-sm truncate" title={c.name}>
                            {c.name}
                          </h3>
                          <a
                            href={c.website || `https://${c.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[11px] text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1"
                          >
                            <span className="truncate">{c.domain}</span>
                            <ExternalLink className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
                          </a>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.is_existing ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                            <span className="h-1 w-1 rounded-full bg-emerald-400" />
                            Saved
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 border border-zinc-700/60">
                              Staged
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDismissCompany(c.domain)}
                              className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded cursor-pointer transition"
                              title="Dismiss from temporary view"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Clean Firmographics Tags (No Emojis) */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-zinc-300 border border-zinc-700/50 flex items-center gap-1 font-medium">
                        {isAgency ? <Building2 className="h-3 w-3 text-zinc-400" /> : <Briefcase className="h-3 w-3 text-zinc-400" />}
                        <span>{isAgency ? "Agency" : "Startup"}</span>
                      </span>

                      {c.source_platform && (
                        <span className="rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-400 font-medium">
                          {c.source_platform}
                        </span>
                      )}

                      {c.size && (
                        <span className="rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-400 flex items-center gap-1">
                          <Users className="h-3 w-3 text-zinc-500" />
                          <span>{c.size}</span>
                        </span>
                      )}

                      {c.location && (
                        <span className="rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-zinc-500" />
                          <span className="truncate max-w-[120px]">{c.location}</span>
                        </span>
                      )}
                    </div>

                    {/* Sanitized Clean Description */}
                    {cleanedDesc && (
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {cleanedDesc}
                      </p>
                    )}

                    {/* Decision-Makers Preview Section */}
                    {c.people && c.people.length > 0 ? (
                      <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-2.5 space-y-2 mt-2">
                        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 border-b border-zinc-800/60 pb-1.5">
                          <span className="flex items-center gap-1.5 text-zinc-200">
                            <Users className="h-3.5 w-3.5 text-zinc-400" />
                            Decision-Makers ({c.people.length})
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {c.is_existing ? "Saved in DB" : "Staged Lead"}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {c.people.slice(0, 2).map((p, idx) => (
                            <div key={idx} className="text-xs space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-medium text-zinc-200">
                                  {p.first_name} {p.last_name}
                                </span>
                                <span className="text-[10px] text-zinc-400 truncate max-w-[130px]" title={p.title}>
                                  {p.title}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                {p.email ? (
                                  <button
                                    onClick={() => handleCopyEmail(p.email!)}
                                    className="flex items-center gap-1.5 font-mono text-zinc-300 hover:text-white transition text-[11px] cursor-pointer"
                                    title="Click to copy email"
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                                    <span className="truncate max-w-[140px]">{p.email}</span>
                                    {copiedEmail === p.email ? (
                                      <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-2.5 w-2.5 text-zinc-500" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-zinc-500 text-[10px]">Email resolving...</span>
                                )}

                                {p.linkedin_url && (
                                  <a
                                    href={formatLinkedInUrl(p.linkedin_url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-zinc-400 hover:text-white text-[10px] shrink-0 transition"
                                  >
                                    <LinkedInIcon className="h-3 w-3" />
                                    <span>Profile</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}

                          {c.people.length > 2 && (
                            <p className="text-[10px] text-zinc-500 text-center pt-0.5">
                              +{c.people.length - 2} more decision-makers
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 p-2.5 flex items-center justify-between gap-2 mt-2">
                        <span className="text-[11px] text-zinc-400">
                          Decision-makers ready to extract
                        </span>
                        <button
                          type="button"
                          onClick={() => handleEnrichCompany(c)}
                          disabled={isEnrichingThis}
                          className="flex items-center gap-1 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition cursor-pointer disabled:opacity-50"
                        >
                          {isEnrichingThis ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                              <span>Scanning...</span>
                            </>
                          ) : (
                            <>
                              <Search className="h-3 w-3 text-zinc-400" />
                              <span>Find Decision-Makers</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewDetails(c)}
                      className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium px-3 py-1.5 text-xs transition cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 text-zinc-400" />
                      <span>View Details</span>
                    </button>

                    {!c.is_existing ? (
                      <button
                        type="button"
                        onClick={() => handleSaveLead(c)}
                        disabled={isSavingThis}
                        className="flex items-center gap-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 font-semibold px-3 py-1.5 text-xs shadow-sm transition cursor-pointer disabled:opacity-50"
                      >
                        {isSavingThis ? (
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
                        href={`/decision-makers?search=${encodeURIComponent(c.name)}`}
                        className="text-xs text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1 font-medium"
                      >
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>Saved</span>
                        <ArrowRight className="h-3 w-3 text-zinc-500" />
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
