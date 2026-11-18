"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
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
  Drawer,
  Skeleton,
} from "@/components/ui";
import {
  Building2,
  Search,
  ExternalLink,
  Users,
  Download,
  Sparkles,
  ArrowRight,
  MapPin,
  Globe,
} from "lucide-react";
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
  snippet?: string;
  description?: string;
}

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

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
          c.industry?.toLowerCase().includes(search.toLowerCase()) ||
          c.location?.toLowerCase().includes(search.toLowerCase())
      )
    : companies;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Target Accounts
            </h1>
            <Badge variant="neutral" size="sm" className="font-mono">
              {companies.length} Accounts
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Discovered target accounts ranked by ICP fit score, tech stack, and decision-maker availability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/discovery">
            <Button variant="outline" size="sm" leftIcon={<Sparkles className="h-3.5 w-3.5" />}>
              Discover More
            </Button>
          </Link>
          <a href="/api/export/companies.csv" download="companies.csv">
            <Button variant="secondary" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}>
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Filter by account name, domain, industry, or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="h-3.5 w-3.5" />}
          className="max-w-md h-8.5"
        />
        {search && (
          <Button variant="ghost" size="xs" onClick={() => setSearch("")}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Data Table Container */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Company / Domain</TableHead>
            <TableHead className="w-[20%]">Industry</TableHead>
            <TableHead className="w-[20%]">Location</TableHead>
            <TableHead className="w-[12%] text-center">Fit Score</TableHead>
            <TableHead className="w-[13%] text-right">Contacts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
                <TableCell><Skeleton className="h-5 w-12 mx-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
              </TableRow>
            ))
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                No target accounts match your search query.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((c) => {
              const fitScore = c.fit ?? 75;
              const fitVariant =
                fitScore >= 80 ? "success" : fitScore >= 60 ? "warning" : "neutral";

              return (
                <TableRow
                  key={c.id}
                  onClick={() => setSelectedCompany(c)}
                  className="cursor-pointer group"
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground font-mono text-[11px] font-semibold">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-foreground text-xs group-hover:text-primary transition-colors">
                          {c.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                          <span>{c.domain}</span>
                          {c.website && (
                            <a
                              href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground/60 hover:text-foreground"
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-xs text-muted-foreground truncate block">
                      {c.industry || "General B2B"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="text-xs text-muted-foreground truncate block">
                      {c.location || "Global"}
                    </span>
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge variant={fitVariant} size="sm" className="font-mono tabular-nums">
                      {fitScore}%
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <Link
                      href={`/decision-makers?search=${encodeURIComponent(c.domain || c.name)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground"
                    >
                      <span>{c.contact_count ?? 0}</span>
                      <Users className="h-3 w-3" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Slide-over Detail Drawer */}
      <Drawer
        isOpen={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        title={selectedCompany?.name}
        description={selectedCompany?.domain}
        size="md"
        footer={
          selectedCompany && (
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-mono text-muted-foreground">
                Fit Score: {selectedCompany.fit ?? 75}%
              </span>
              <Link
                href={`/decision-makers?search=${encodeURIComponent(
                  selectedCompany.domain || selectedCompany.name
                )}`}
              >
                <Button variant="primary" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                  Inspect Decision-Makers
                </Button>
              </Link>
            </div>
          )
        }
      >
        {selectedCompany && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Domain / Website</span>
                <a
                  href={
                    selectedCompany.website?.startsWith("http")
                      ? selectedCompany.website
                      : `https://${selectedCompany.domain}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-foreground hover:underline inline-flex items-center gap-1"
                >
                  <span>{selectedCompany.domain}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Industry</span>
                <span className="text-foreground">{selectedCompany.industry || "General B2B"}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Location</span>
                <span className="text-foreground">{selectedCompany.location || "Global"}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Decision-Makers Count</span>
                <Badge variant="neutral" size="sm" className="font-mono">
                  {selectedCompany.contact_count ?? 0} Contacts
                </Badge>
              </div>
            </div>

            {(selectedCompany.description || selectedCompany.snippet) && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-foreground">Company Overview & Signals</h4>
                <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedCompany.description || selectedCompany.snippet}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
