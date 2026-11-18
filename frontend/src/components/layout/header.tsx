"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useOutreachStatus } from "@/hooks/use-outreach-status";
import { useTheme } from "@/hooks/use-theme";
import { CommandPalette } from "@/components/layout/command-palette";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import {
  Play,
  Square,
  Search,
  Command,
  Sun,
  Moon,
  Monitor,
  Menu,
  ChevronRight,
  Cpu,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onToggleMobileSidebar?: () => void;
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
}

export function Header({
  onToggleMobileSidebar,
  onToggleCollapse,
  isCollapsed = false,
}: HeaderProps) {
  const pathname = usePathname();
  const { isRunning, startOutreach, stopOutreach, isStarting, isStopping, aiStatus } =
    useOutreachStatus();
  const { theme, setTheme } = useTheme();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global Keyboard Shortcuts (⌘K for command palette, ⌘B for sidebar toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        onToggleCollapse?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleCollapse]);

  // Generate readable breadcrumb segment
  const getBreadcrumbs = () => {
    if (pathname === "/") {
      return { section: "Overview", page: "Today" };
    }

    const segments = pathname.split("/").filter(Boolean);
    const main = segments[0] || "";

    const map: Record<string, { section: string; page: string }> = {
      companies: { section: "Pipeline", page: "Target Accounts" },
      "decision-makers": { section: "Pipeline", page: "Decision-Makers" },
      prospects: { section: "Pipeline", page: "Contacts Registry" },
      discovery: {
        section: "Pipeline",
        page: segments[1] === "enrich" ? "URL Enrichment" : "ICP Discovery",
      },
      signals: { section: "Pipeline", page: "Buying Signals" },
      outbox: { section: "Outbound", page: "Outbox Review" },
      conversations: { section: "Outbound", page: "Conversations & Replies" },
      campaigns: { section: "Outbound", page: "Campaign Cadence" },
      "outreach-prep": { section: "Outbound", page: "Pitch Studio" },
      controls: { section: "Operations", page: "Agent Console & Logs" },
      usage: { section: "Operations", page: "AI Telemetry & Cost" },
      inboxes: { section: "Operations", page: "Inboxes & Health" },
      settings: { section: "Operations", page: "Settings & ICP" },
      company: { section: "Operations", page: "Company Value Prop" },
      activity: { section: "Operations", page: "System Activity" },
    };

    return (
      map[main] || {
        section: "App",
        page: main.charAt(0).toUpperCase() + main.slice(1),
      }
    );
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-border bg-background/80 px-4 sm:px-6 backdrop-blur-xl transition-all">
        {/* Left: Mobile Drawer Trigger, Desktop Sidebar Toggle & Breadcrumbs */}
        <div className="flex items-center gap-2.5">
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden cursor-pointer"
              title="Open mobile menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              title={isCollapsed ? "Expand sidebar (⌘B)" : "Collapse sidebar (⌘B)"}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}

          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground hidden sm:inline">
              {breadcrumbs.section}
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/40 hidden sm:inline" />
            <span className="font-semibold text-foreground tracking-tight">
              {breadcrumbs.page}
            </span>
          </nav>

          <div className="hidden xl:flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>:5555</span>
          </div>

          {aiStatus && (
            <div className="hidden 2xl:flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Cpu className="h-3 w-3 text-muted-foreground" />
              <span>DeepSeek {aiStatus.model || "chat"}</span>
            </div>
          )}
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="flex-1 max-w-sm mx-4 hidden md:block">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex h-8 w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-3 text-xs text-muted-foreground hover:border-border/80 hover:bg-muted/60 transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span className="truncate">Quick jump or search...</span>
            </span>
            <kbd className="inline-flex items-center gap-0.5 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
              <Command className="h-2.5 w-2.5" /> K
            </kbd>
          </button>
        </div>

        {/* Right: Agent Engine Controls & Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* Quick Command Icon for Mobile */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground md:hidden cursor-pointer"
            title="Search (⌘K)"
          >
            <Search className="h-3.5 w-3.5" />
          </button>

          {/* Theme Selector Segmented Control */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              onClick={() => setTheme("light")}
              title="Light mode"
              className={cn(
                "flex h-6.5 w-6.5 items-center justify-center rounded-md text-xs transition cursor-pointer",
                theme === "light"
                  ? "bg-card text-foreground shadow-2xs font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sun className="h-3 w-3" />
            </button>
            <button
              onClick={() => setTheme("dark")}
              title="Dark mode"
              className={cn(
                "flex h-6.5 w-6.5 items-center justify-center rounded-md text-xs transition cursor-pointer",
                theme === "dark"
                  ? "bg-card text-foreground shadow-2xs font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Moon className="h-3 w-3" />
            </button>
            <button
              onClick={() => setTheme("auto")}
              title="System auto"
              className={cn(
                "flex h-6.5 w-6.5 items-center justify-center rounded-md text-xs transition cursor-pointer",
                theme === "auto"
                  ? "bg-card text-foreground shadow-2xs font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Monitor className="h-3 w-3" />
            </button>
          </div>

          {/* Engine Power Action Button */}
          {isRunning ? (
            <Button
              variant="destructive"
              size="sm"
              isLoading={isStopping}
              onClick={() => stopOutreach()}
              leftIcon={<Square className="h-3 w-3 fill-current" />}
            >
              <span className="hidden sm:inline">Pause Outbound</span>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              isLoading={isStarting}
              onClick={() => startOutreach()}
              leftIcon={<Play className="h-3 w-3 fill-current" />}
            >
              <span className="hidden sm:inline">Start Outbound</span>
            </Button>
          )}
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </>
  );
}
