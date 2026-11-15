"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { DecisionMaker } from "@/lib/types";
import {
  Users,
  Search,
  Filter,
  Download,
  Sparkles,
  ExternalLink,
  Mail,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Send,
  X,
  Loader2,
  Copy,
  Check,
  FileText,
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
  const { data, isLoading, refetch } = useQuery<{
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
      await fetchApi("/api/prospecting/approve-outreach", {
        method: "POST",
        body: JSON.stringify({
          prospect_id: selectedProspect.id,
          subject: proposalDraft.subject,
          body: proposalDraft.body,
        }),
      });
      setSelectedProspect(null);
      setProposalDraft(null);
      queryClient.invalidateQueries({ queryKey: ["decision-makers"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-stats"] });
      queryClient.invalidateQueries({ queryKey: ["outbox-items"] });
    } catch (err: any) {
      setModalError(err.message || "Failed to approve proposal.");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Decision-Makers</h1>
            <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 ring-1 ring-indigo-500/20">
              {data?.total ?? 0} Discovered
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Enriched technical leadership and decision-makers discovered by DeepSeek Brain.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <a
            href="/api/prospecting/decision-makers?format=csv"
            download="decision-makers.csv"
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, title, company, or domain..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Deliverability Filter */}
          <select
            value={deliverabilityFilter}
            onChange={(e) => setDeliverabilityFilter(e.target.value)}
            className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
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
            className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            <option value="">All Role Priorities</option>
            <option value="1">Priority 1 (CTO / VP / Founder)</option>
            <option value="2">Priority 2 (Head / Lead)</option>
            <option value="3">Priority 3 (Manager)</option>
          </select>
        </div>
      </div>

      {/* Decision-Makers Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase tracking-wider text-[11px] text-slate-400">
              <tr>
                <th className="px-5 py-3.5 font-medium">Decision-Maker</th>
                <th className="px-5 py-3.5 font-medium">Company</th>
                <th className="px-5 py-3.5 font-medium">Email & Deliverability</th>
                <th className="px-5 py-3.5 font-medium">Signals / Dossier</th>
                <th className="px-5 py-3.5 text-right font-medium">AI Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky-400 mb-2" />
                    <span>Loading decision-makers...</span>
                  </td>
                </tr>
              ) : decisionMakers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No decision-makers matched your filters.
                  </td>
                </tr>
              ) : (
                decisionMakers.map((dm) => {
                  const isVerified = dm.email_status === "verified";
                  const isDeliverable = dm.email_status === "deliverable";
                  const confidence = Math.round((dm.email_match_confidence || 0.85) * 100);

                  return (
                    <tr
                      key={dm.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Name & Title */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white group-hover:text-sky-300 transition-colors">
                          {dm.full_name}
                        </div>
                        <div className="text-[11px] text-slate-400">{dm.title || "Leadership"}</div>
                        {dm.role_priority && (
                          <span className="mt-1 inline-block rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400 border border-indigo-500/20">
                            P{dm.role_priority} Priority
                          </span>
                        )}
                      </td>

                      {/* Company & Domain */}
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-200">{dm.company_name}</div>
                        {dm.company_domain && (
                          <a
                            href={`https://${dm.company_domain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <span>{dm.company_domain}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </td>

                      {/* Email & Status */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
                          <Mail className="h-3.5 w-3.5 text-slate-500" />
                          <span>{dm.email || "No direct email"}</span>
                          {dm.email && (
                            <button
                              onClick={() => handleCopy(dm.email)}
                              title="Copy email address"
                              className="text-slate-500 hover:text-white transition ml-1 cursor-pointer"
                            >
                              {copiedEmail === dm.email ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              isVerified
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                : isDeliverable
                                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                                : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {isVerified ? (
                              <CheckCircle className="h-2.5 w-2.5" />
                            ) : (
                              <HelpCircle className="h-2.5 w-2.5" />
                            )}
                            <span className="capitalize">{dm.email_status || "Guess"}</span>
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {confidence}% match
                          </span>
                        </div>
                      </td>

                      {/* Profiles & Evidence */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {dm.linkedin_url && (
                            <a
                              href={formatLinkedInUrl(dm.linkedin_url)}
                              target="_blank"
                              rel="noreferrer"
                              title="LinkedIn Profile"
                              className="text-slate-400 hover:text-sky-400 transition"
                            >
                              <LinkedInIcon className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {dm.github_url && (
                            <a
                              href={dm.github_url}
                              target="_blank"
                              rel="noreferrer"
                              title="GitHub Profile"
                              className="text-slate-400 hover:text-white transition"
                            >
                              <GitHubIcon className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {dm.twitter_url && (
                            <a
                              href={dm.twitter_url}
                              target="_blank"
                              rel="noreferrer"
                              title="Twitter / X Profile"
                              className="text-slate-400 hover:text-sky-400 transition"
                            >
                              <TwitterXIcon className="h-3.5 w-3.5" />
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
                              title="View buying signals evidence"
                              className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700 transition"
                            >
                              <FileText className="h-3 w-3 text-sky-400" />
                              <span>Evidence</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* AI Action */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleOpenDraftModal(dm)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                          <span>AI Pitch</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence Viewer Modal */}
      {viewingEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-white text-sm">
                Signals & Evidence: {viewingEvidence.name}
              </h3>
              <button
                onClick={() => setViewingEvidence(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
              {viewingEvidence.notes}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingEvidence(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Proposal Drafting Modal */}
      {selectedProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Tailored Pitch for {selectedProspect.full_name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedProspect.title} at {selectedProspect.company_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProspect(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-5 space-y-4">
              {isDrafting ? (
                <div className="py-16 text-center text-slate-400">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-400 mb-3" />
                  <p className="text-sm font-medium text-white">DeepSeek Brain is thinking...</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Analyzing profile, value proposition, and company pain points
                  </p>
                </div>
              ) : modalError ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 inline mr-1 text-rose-400" />
                  <span>{modalError}</span>
                </div>
              ) : proposalDraft ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400">Subject Line</label>
                    <input
                      type="text"
                      value={proposalDraft.subject}
                      onChange={(e) =>
                        setProposalDraft({ ...proposalDraft, subject: e.target.value })
                      }
                      className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400">Email Pitch</label>
                    <textarea
                      rows={10}
                      value={proposalDraft.body}
                      onChange={(e) =>
                        setProposalDraft({ ...proposalDraft, body: e.target.value })
                      }
                      className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 font-mono text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {proposalDraft && (
              <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Recipient: {selectedProspect.email}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedProspect(null)}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApproveAndQueue}
                    disabled={isApproving}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-600/20"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{isApproving ? "Queuing..." : "Approve & Send to Outbox"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
