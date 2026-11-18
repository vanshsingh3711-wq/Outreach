"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { DecisionMaker } from "@/lib/types";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Badge,
  Button,
  Input,
  Modal,
  Textarea,
  Skeleton,
} from "@/components/ui";
import {
  Users,
  Search,
  Download,
  Sparkles,
  ExternalLink,
  Mail,
  Check,
  Copy,
  FileText,
  AlertCircle,
  Loader2,
  Building2,
} from "lucide-react";
import { LinkedInIcon, GitHubIcon, TwitterXIcon } from "@/components/ui/brand-icons";

function formatLinkedInUrl(url?: string): string {
  if (!url) return "";
  const cleaned = url.replace(/https?:\/\/([a-z]{2,3}\.)?linkedin\.com/i, "https://www.linkedin.com");
  const base = cleaned.split("?")[0];
  return `${base}?locale=en_US`;
}

export default function DecisionMakersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [deliverabilityFilter, setDeliverabilityFilter] = useState("");
  const [rolePriorityFilter, setRolePriorityFilter] = useState("");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Evidence notes modal
  const [viewingEvidence, setViewingEvidence] = useState<{ name: string; notes: string } | null>(null);

  // Modal state for drafting pitch
  const [selectedProspect, setSelectedProspect] = useState<DecisionMaker | null>(null);
  const [proposalDraft, setProposalDraft] = useState<{ subject: string; body: string } | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Fetch decision makers
  const { data, isLoading } = useQuery<{
    total: number;
    decision_makers: DecisionMaker[];
  }>({
    queryKey: ["decision-makers", searchTerm, deliverabilityFilter, rolePriorityFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (deliverabilityFilter) params.set("deliverability", deliverabilityFilter);
      if (rolePriorityFilter) params.set("role_priority", rolePriorityFilter);
      return fetchApi(`/api/prospecting/decision-makers?${params.toString()}`);
    },
  });

  const decisionMakers = data?.decision_makers || [];

  const handleCopy = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleOpenDraftModal = async (prospect: DecisionMaker) => {
    setSelectedProspect(prospect);
    setProposalDraft(null);
    setModalError(null);
    setIsDrafting(true);

    try {
      const res = await fetchApi<{ subject: string; body: string }>(
        "/api/prospecting/draft-proposal",
        {
          method: "POST",
          body: JSON.stringify({ prospect_id: prospect.id }),
        }
      );
      setProposalDraft(res);
    } catch (err: any) {
      setModalError(err.message || "Failed to generate AI proposal draft.");
    } finally {
      setIsDrafting(false);
    }
  };

  const handleApproveAndQueue = async () => {
    if (!selectedProspect || !proposalDraft) return;
    setIsApproving(true);
    setModalError(null);

    try {
      await fetchApi("/api/prospecting/approve-proposal", {
        method: "POST",
        body: JSON.stringify({
          prospect_id: selectedProspect.id,
          subject: proposalDraft.subject,
          body: proposalDraft.body,
        }),
      });

      queryClient.invalidateQueries({ queryKey: ["decision-makers"] });
      queryClient.invalidateQueries({ queryKey: ["outbox-items"] });
      queryClient.invalidateQueries({ queryKey: ["today-dashboard"] });
      setSelectedProspect(null);
    } catch (err: any) {
      setModalError(err.message || "Failed to queue draft to outbox.");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Decision-Makers & Leads
            </h1>
            <Badge variant="neutral" size="sm" className="font-mono">
              {data?.total ?? 0} Discovered
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Enriched technical leadership, executives, and buyers identified by DeepSeek Brain.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/prospecting/decision-makers?format=csv"
            download="decision-makers.csv"
          >
            <Button variant="secondary" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}>
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Filter by name, title, company, or domain..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="h-3.5 w-3.5" />}
          className="max-w-md h-8.5"
        />

        <div className="flex items-center gap-2">
          {/* Deliverability Filter */}
          <select
            value={deliverabilityFilter}
            onChange={(e) => setDeliverabilityFilter(e.target.value)}
            className="h-8.5 rounded-lg border border-input bg-background/60 px-3 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All Deliverability</option>
            <option value="verified">Verified Only</option>
            <option value="deliverable">Deliverable</option>
            <option value="guess">Pattern Guess</option>
          </select>

          {/* Role Priority Filter */}
          <select
            value={rolePriorityFilter}
            onChange={(e) => setRolePriorityFilter(e.target.value)}
            className="h-8.5 rounded-lg border border-input bg-background/60 px-3 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All Role Priorities</option>
            <option value="1">Priority 1 (CTO / VP / Founder)</option>
            <option value="2">Priority 2 (Head / Lead)</option>
            <option value="3">Priority 3 (Manager)</option>
          </select>
        </div>
      </div>

      {/* Decision-Makers Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">Decision-Maker</TableHead>
            <TableHead className="w-[22%]">Company</TableHead>
            <TableHead className="w-[25%]">Email & Deliverability</TableHead>
            <TableHead className="w-[10%]">Evidence</TableHead>
            <TableHead className="w-[13%] text-right">AI Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
                <TableCell><Skeleton className="h-5 w-2/3" /></TableCell>
                <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
              </TableRow>
            ))
          ) : decisionMakers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                No decision-makers matched your filters.
              </TableCell>
            </TableRow>
          ) : (
            decisionMakers.map((dm) => {
              const isVerified = dm.email_status === "verified";
              const isDeliverable = dm.email_status === "deliverable";
              const isPatternGuess = dm.email_status === "guess";

              return (
                <TableRow key={dm.id} className="group">
                  {/* Name and Title */}
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground font-mono text-[11px] font-semibold">
                        {(dm.first_name?.[0] || "") + (dm.last_name?.[0] || "")}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground text-xs group-hover:text-primary transition-colors">
                            {dm.full_name}
                          </span>
                          {dm.role_priority && (
                            <span className="rounded bg-muted px-1 text-[9px] font-mono text-muted-foreground border border-border">
                              P{dm.role_priority}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{dm.title}</p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Company */}
                  <TableCell>
                    <span className="font-medium text-foreground text-xs block truncate">
                      {dm.company_name}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground block truncate">
                      {dm.company_domain}
                    </span>
                  </TableCell>

                  {/* Email & Status */}
                  <TableCell>
                    {dm.email ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-foreground truncate max-w-[190px]">
                            {dm.email}
                          </span>
                          <button
                            onClick={() => handleCopy(dm.email!)}
                            title="Copy email address"
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {copiedEmail === dm.email ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        <Badge
                          variant={isVerified ? "success" : isDeliverable ? "info" : isPatternGuess ? "warning" : "neutral"}
                          size="sm"
                          dot
                        >
                          {isVerified ? "Verified" : isDeliverable ? "Deliverable" : isPatternGuess ? "Pattern Guess" : "Unchecked"}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">No email found</span>
                    )}
                  </TableCell>

                  {/* Social Profile & Evidence */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {dm.linkedin_url && (
                        <a
                          href={formatLinkedInUrl(dm.linkedin_url)}
                          target="_blank"
                          rel="noreferrer"
                          title="LinkedIn Profile"
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                        >
                          <LinkedInIcon className="h-3.5 w-3.5 fill-current" />
                        </a>
                      )}
                      {dm.github_url && (
                        <a
                          href={dm.github_url}
                          target="_blank"
                          rel="noreferrer"
                          title="GitHub Profile"
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                        >
                          <GitHubIcon className="h-3.5 w-3.5 fill-current" />
                        </a>
                      )}
                      {dm.twitter_url && (
                        <a
                          href={dm.twitter_url}
                          target="_blank"
                          rel="noreferrer"
                          title="Twitter Profile"
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                        >
                          <TwitterXIcon className="h-3 w-3 fill-current" />
                        </a>
                      )}
                      {dm.evidence && (
                        <button
                          onClick={() =>
                            setViewingEvidence({
                              name: dm.full_name,
                              notes: dm.evidence || "",
                            })
                          }
                          title="View evidence notes"
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </TableCell>

                  {/* AI Action Pitch Button */}
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleOpenDraftModal(dm)}
                      leftIcon={<Sparkles className="h-3 w-3 text-primary" />}
                    >
                      AI Pitch
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Evidence Viewer Modal */}
      <Modal
        isOpen={!!viewingEvidence}
        onClose={() => setViewingEvidence(null)}
        title={`Signals & Evidence: ${viewingEvidence?.name}`}
        description="Source observations and rationale from scraping & enrichment"
        footer={
          <Button variant="outline" size="sm" onClick={() => setViewingEvidence(null)}>
            Close
          </Button>
        }
      >
        <div className="rounded-lg border border-border bg-muted/20 p-4 font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
          {viewingEvidence?.notes}
        </div>
      </Modal>

      {/* AI Proposal Drafting Modal */}
      <Modal
        isOpen={!!selectedProspect}
        onClose={() => setSelectedProspect(null)}
        title={selectedProspect ? `Personalized Pitch for ${selectedProspect.full_name}` : "Draft Pitch"}
        description={
          selectedProspect
            ? `${selectedProspect.title} at ${selectedProspect.company_name}`
            : undefined
        }
        maxWidth="xl"
        footer={
          proposalDraft && (
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[200px]">
                To: {selectedProspect?.email}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedProspect(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApproveAndQueue}
                  isLoading={isApproving}
                  leftIcon={<Check className="h-3.5 w-3.5" />}
                >
                  Approve & Queue to Outbox
                </Button>
              </div>
            </div>
          )
        }
      >
        <div className="py-2 space-y-3.5">
          {isDrafting ? (
            <div className="py-14 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary mb-2.5" />
              <p className="text-xs font-semibold text-foreground">DeepSeek Brain is crafting pitch...</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Connecting ICP value proposition, recent company signals, and prospect role pain points.
              </p>
            </div>
          ) : modalError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          ) : proposalDraft ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Subject Line</label>
                <Input
                  value={proposalDraft.subject}
                  onChange={(e) => setProposalDraft({ ...proposalDraft, subject: e.target.value })}
                  placeholder="Subject line"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Email Pitch</label>
                <Textarea
                  rows={10}
                  value={proposalDraft.body}
                  onChange={(e) => setProposalDraft({ ...proposalDraft, body: e.target.value })}
                  className="font-mono leading-relaxed"
                />
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
