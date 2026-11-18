"use client";

import React, { useState } from "react";
import { fetchApi } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Input,
} from "@/components/ui";
import {
  Search,
  Globe,
  Users,
  Building2,
  CheckCircle2,
  AlertCircle,
  Mail,
  Copy,
  Check,
  BookmarkPlus,
  Zap,
  ExternalLink,
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
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Target URL Enrichment
            </h1>
            <Badge variant="default" size="sm">
              DeepScan
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Instant on-demand scan of any company website to extract founders, verified emails, and tech stack.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/discovery">
            <Button variant="outline" size="sm">
              Back to ICP Discovery
            </Button>
          </Link>
        </div>
      </div>

      {/* URL Enrichment Input Card */}
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleEnrich} className="space-y-3">
            <label className="text-xs font-medium text-foreground">Target Company Website</label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="https://company.com or domain.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                leftIcon={<Globe className="h-4 w-4" />}
                className="h-9"
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                disabled={!url.trim()}
                leftIcon={<Search className="h-3.5 w-3.5" />}
              >
                Scan Domain
              </Button>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Enriched Result Details */}
      {result && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Company Metadata Card */}
          <Card className="p-5">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {result.company?.name || "Company Profile"}
                    </h3>
                    <Badge variant={isSaved ? "success" : "warning"} size="sm" dot>
                      {isSaved ? "Saved to Target Accounts" : "Temporary Staged"}
                    </Badge>
                  </div>
                  <a
                    href={result.canonical_url || url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <span>{result.company?.domain || url}</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>

              {!isSaved && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveToDb}
                  isLoading={isSaving}
                  leftIcon={<BookmarkPlus className="h-3.5 w-3.5" />}
                >
                  Save Account & Contacts
                </Button>
              )}
            </div>

            {result.company?.description && (
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
                {result.company.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {result.company?.industry && (
                <Badge variant="outline" size="sm">
                  Industry: {result.company.industry}
                </Badge>
              )}
              {result.company?.location && (
                <Badge variant="outline" size="sm">
                  Location: {result.company.location}
                </Badge>
              )}
            </div>
          </Card>

          {/* Discovered Decision-Makers */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Discovered Contacts & Decision-Makers ({result.people?.length || 0})
              </h3>
            </div>

            {result.people?.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted-foreground">
                No individual decision-maker profiles detected on the homepage or about pages.
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.people?.map((p: any, idx: number) => {
                  const email = p.primary_email || p.email;
                  const isVerified = p.email_status === "verified";

                  return (
                    <Card key={idx} className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-xs font-semibold text-foreground">
                            {p.first_name} {p.last_name}
                          </h4>
                          <p className="text-[11px] text-muted-foreground truncate">{p.title || "Contact"}</p>
                        </div>
                        {p.linkedin_url && (
                          <a
                            href={formatLinkedInUrl(p.linkedin_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <LinkedInIcon className="h-3.5 w-3.5 fill-current" />
                          </a>
                        )}
                      </div>

                      {email && (
                        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                          <span className="font-mono text-[11px] text-foreground truncate max-w-[180px]">
                            {email}
                          </span>
                          <button
                            onClick={() => handleCopyEmail(email)}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {copiedEmail === email ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px]">
                        <Badge variant={isVerified ? "success" : "neutral"} size="sm" dot>
                          {isVerified ? "Verified" : p.email_status || "Unverified"}
                        </Badge>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
