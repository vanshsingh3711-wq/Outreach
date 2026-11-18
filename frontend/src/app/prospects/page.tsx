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
  Skeleton,
} from "@/components/ui";
import {
  Mail,
  Search,
  Download,
  Copy,
  Check,
  Building2,
  Users,
} from "lucide-react";
import Link from "next/link";

export default function ProspectsPage() {
  const [search, setSearch] = useState("");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

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

  const handleCopy = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Contacts Registry
            </h1>
            <Badge variant="neutral" size="sm" className="font-mono">
              {prospects.length} Contacts
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Complete database of individual verified contacts and their outreach lifecycle status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/decision-makers">
            <Button variant="outline" size="sm" leftIcon={<Users className="h-3.5 w-3.5" />}>
              Open Decision-Makers
            </Button>
          </Link>
          <a href="/api/export/prospects.csv" download="prospects.csv">
            <Button variant="secondary" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}>
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Filter by contact name, email, company, title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="h-3.5 w-3.5" />}
          className="max-w-md h-8.5"
        />
        {search && (
          <Button variant="ghost" size="xs" onClick={() => setSearch("")}>
            Clear
          </Button>
        )}
      </div>

      {/* Contacts Data Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">Contact</TableHead>
            <TableHead className="w-[25%]">Company</TableHead>
            <TableHead className="w-[25%]">Email Address</TableHead>
            <TableHead className="w-[10%]">Verification</TableHead>
            <TableHead className="w-[10%] text-right">Lifecycle Stage</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
                <TableCell><Skeleton className="h-5 w-2/3" /></TableCell>
                <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-14 ml-auto" /></TableCell>
              </TableRow>
            ))
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                No contacts match your filter.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((p) => {
              const isVerified = p.email_status === "verified" || p.email_verified;

              return (
                <TableRow key={p.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground font-mono text-[11px] font-semibold">
                        {(p.first_name?.[0] || "") + (p.last_name?.[0] || "")}
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-foreground text-xs group-hover:text-primary transition-colors">
                          {p.first_name} {p.last_name}
                        </span>
                        <p className="text-[11px] text-muted-foreground truncate">{p.title || "Contact"}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-xs font-medium text-foreground truncate block">
                      {p.company || "—"}
                    </span>
                  </TableCell>

                  <TableCell>
                    {p.email ? (
                      <div className="flex items-center gap-1.5 font-mono text-xs text-foreground">
                        <span className="truncate">{p.email}</span>
                        <button
                          onClick={() => handleCopy(p.email)}
                          title="Copy email"
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {copiedEmail === p.email ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">No email</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge variant={isVerified ? "success" : "neutral"} size="sm" dot>
                      {isVerified ? "Verified" : "Unverified"}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <span className="text-xs font-mono capitalize text-muted-foreground">
                      {p.stage || p.status || "Identified"}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
