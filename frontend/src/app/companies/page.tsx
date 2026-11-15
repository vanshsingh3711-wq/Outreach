"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { Building2, Search, ExternalLink, Users, Download, Loader2 } from "lucide-react";
import Link from "next/link";

interface Company {
  id: string;
  name: string;
  domain: string;
  industry?: string;
  location?: string;
  website?: string;
  fit?: number;
  contact_count?: number;
  created_at?: string;
}

export default function CompaniesPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<Company[]>({
    queryKey: ["companies-list"],
    queryFn: () => fetchApi<Company[]>("/api/companies"),
  });

  const companies = data || [];
  const filtered = search
    ? companies.filter(
        (c) =>
          c.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.domain?.toLowerCase().includes(search.toLowerCase()) ||
          c.industry?.toLowerCase().includes(search.toLowerCase())
      )
    : companies;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Target Accounts</h1>
            <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 border border-sky-500/20">
              {companies.length} Accounts
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Discovered target organizations ranked by fit score and decision-maker availability.
          </p>
        </div>

        <a
          href="/api/export/companies.csv"
          download="companies.csv"
          className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </a>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Filter by account name, domain, industry..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-900/40 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase tracking-wider text-[11px] text-slate-400">
              <tr>
                <th className="px-5 py-3.5 font-medium">Company</th>
                <th className="px-5 py-3.5 font-medium">Industry</th>
                <th className="px-5 py-3.5 font-medium">Location</th>
                <th className="px-5 py-3.5 font-medium">Fit Score</th>
                <th className="px-5 py-3.5 text-right font-medium">Contacts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky-400 mb-2" />
                    <span>Loading target companies...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No companies found.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white">{c.name}</div>
                      {c.domain && (
                        <a
                          href={`https://${c.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-sky-400 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <span>{c.domain}</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">{c.industry || "Technology"}</td>
                    <td className="px-5 py-3.5 text-slate-400">{c.location || "Remote"}</td>
                    <td className="px-5 py-3.5">
                      {c.fit != null ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                          {c.fit}% Match
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/decision-makers?search=${encodeURIComponent(c.name)}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 transition"
                      >
                        <Users className="h-3 w-3 text-slate-400" />
                        <span>{c.contact_count || 0} leads</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

