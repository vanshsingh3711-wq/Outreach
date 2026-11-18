"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Home,
  Building2,
  Users,
  Compass,
  Radio,
  Send,
  MessageSquare,
  Layers,
  PenTool,
  Terminal,
  BarChart3,
  Inbox,
  Settings,
  ArrowRight,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  name: string;
  href: string;
  category: "Overview" | "Pipeline" | "Outreach" | "Operations";
  icon: React.ElementType;
  keywords?: string;
}

const COMMAND_ITEMS: CommandItem[] = [
  { name: "Today / Mission Control", href: "/", category: "Overview", icon: Home, keywords: "dashboard today tasks pending" },
  { name: "Target Accounts", href: "/companies", category: "Pipeline", icon: Building2, keywords: "companies organizations domains accounts" },
  { name: "Decision-Makers", href: "/decision-makers", category: "Pipeline", icon: Users, keywords: "leads prospects contacts people titles" },
  { name: "Contacts Registry", href: "/prospects", category: "Pipeline", icon: Users, keywords: "contacts emails prospects all" },
  { name: "ICP Discovery Engine", href: "/discovery", category: "Pipeline", icon: Compass, keywords: "search find discover icp google map domain" },
  { name: "URL Enrichment", href: "/discovery/enrich", category: "Pipeline", icon: Compass, keywords: "enrich scrape website linkedin" },
  { name: "Buying Signals", href: "/signals", category: "Pipeline", icon: Radio, keywords: "signals triggers events hiring tech stack" },
  { name: "Outbox & Review Queue", href: "/outbox", category: "Outreach", icon: Send, keywords: "outbox approve send draft email pending" },
  { name: "Conversations & Replies", href: "/conversations", category: "Outreach", icon: MessageSquare, keywords: "inbox replies sentiment threads human handoff" },
  { name: "Outbound Campaigns", href: "/campaigns", category: "Outreach", icon: Layers, keywords: "campaigns sequences cadence steps" },
  { name: "Pitch Studio (Outreach Prep)", href: "/outreach-prep", category: "Outreach", icon: PenTool, keywords: "prep pitch write test angles preview" },
  { name: "Agent Console & Logs", href: "/controls", category: "Operations", icon: Terminal, keywords: "logs terminal controls start stop agent process" },
  { name: "AI Usage & Telemetry", href: "/usage", category: "Operations", icon: BarChart3, keywords: "tokens cost usage analytics telemetry deepseek" },
  { name: "Inboxes & Deliverability", href: "/inboxes", category: "Operations", icon: Inbox, keywords: "gmail smtp deliverability inboxes mailboxes" },
  { name: "Settings & ICP", href: "/settings", category: "Operations", icon: Settings, keywords: "settings api keys config company icp value proposition" },
  { name: "Company Profile", href: "/company", category: "Operations", icon: Building2, keywords: "company profile product offer pitch" },
];

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Global keyboard listener for Command+K / Ctrl+K
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelectedIndex(0);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return COMMAND_ITEMS;
    const lower = query.toLowerCase();
    return COMMAND_ITEMS.filter(
      (item) =>
        item.name.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower) ||
        item.keywords?.toLowerCase().includes(lower)
    );
  }, [query]);

  // Keyboard navigation within list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      e.preventDefault();
      router.push(filteredItems[selectedIndex].href);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      />

      {/* Palette Container */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-3" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search navigation, accounts, outbox, settings..."
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No matching pages found for "{query}"
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = selectedIndex === index;

                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      router.push(item.href);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer text-left select-none",
                      isSelected
                        ? "bg-secondary text-foreground font-medium"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                        {item.category}
                      </span>
                      {isSelected && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground animate-in fade-in duration-100" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-card px-1 text-[10px] font-mono">↑</kbd>
              <kbd className="rounded border border-border bg-card px-1 text-[10px] font-mono">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-card px-1 text-[10px] font-mono">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" />
            <span>K to toggle</span>
          </span>
        </div>
      </div>
    </div>
  );
}
