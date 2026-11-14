"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { Mail, Search, Download, CheckCircle, HelpCircle, Loader2, User } from "lucide-react";

export default function ProspectsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["prospects-list"],
    queryFn: () => fetchApi<any[]>("/api/prospects"),
  });

  const prospects = data || [];
  const filtered = search
    ? prospects.filter(
        (p) =>
          p.first_name?.toLowerCase().includes(search.toLowerCase()) ||
          p.last_name?.toLowerCase().includes(search.toLowerCase()) ||
          p.email?.toLowerCase().includes(search.toLowerCase()) ||
          p.company?.toLowerCase().includes(search.toLowerCase()) ||
          p.title?.toLowerCase().includes(search.toLowerCase())
      )
    : prospects;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Contacts & Prospects</h1>
            <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              {prospects.length} Contacts
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Full registry of individual decision-maker contacts and their delivery status.
          </p>
        </div>

        <a
          href="/api/export/prospects.csv"
          download="prospects.csv"
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
          placeholder="Filter by contact name, email, company, title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-900/40 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase tracking-wider text-[11px] text-slate-400">
              <tr>
                <th className="px-5 py-3.5 font-medium">Contact</th>
                <th className="px-5 py-3.5 font-medium">Company</th>
                <th className="px-5 py-3.5 font-medium">Email</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 text-right font-medium">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-400 mb-2" />
                    <span>Loading contacts...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No contacts found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isVerified = p.email_status === "verified" || p.email_verified;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white">
                          {p.first_name} {p.last_name}
                        </div>
                        <div className="text-[11px] text-slate-400">{p.title || "Contact"}</div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-200">{p.company || "Unknown"}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-slate-300">{p.email || "No email"}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            isVerified
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {isVerified ? <CheckCircle className="h-2.5 w-2.5" /> : null}
                          <span className="capitalize">{p.email_status || "Standard"}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase font-mono text-slate-300">
                          {p.status || "new"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
