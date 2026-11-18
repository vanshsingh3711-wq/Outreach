"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOutreachStatus } from "@/hooks/use-outreach-status";
import { useToday } from "@/hooks/use-today";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Building2,
  Inbox,
  Mail,
  MessageSquare,
  Sparkles,
  Users,
  PenTool,
  Radio,
  Layers,
  Send,
  BarChart3,
  Terminal,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Compass,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: number | string | null;
  badgeVariant?: "default" | "neutral" | "warning" | "destructive" | "info";
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const { isRunning, pid } = useOutreachStatus();
  const { data: todayData } = useToday();

  const stats = todayData?.stats;
  const pendingItemsCount = todayData?.items?.length || 0;

  // Streamlined 4 Core Functional Clusters
  const sections: NavSection[] = [
    {
      title: "Overview",
      items: [
        {
          name: "Today",
          href: "/",
          icon: Home,
          badge: pendingItemsCount > 0 ? pendingItemsCount : null,
          badgeVariant: "warning",
        },
      ],
    },
    {
      title: "Pipeline & Intelligence",
      items: [
        {
          name: "Target Accounts",
          href: "/companies",
          icon: Building2,
          badge: stats?.companies ? stats.companies : null,
          badgeVariant: "neutral",
        },
        {
          name: "Decision-Makers",
          href: "/decision-makers",
          icon: Users,
        },
        {
          name: "Contacts Registry",
          href: "/prospects",
          icon: Mail,
        },
        {
          name: "ICP Discovery",
          href: "/discovery",
          icon: Compass,
        },
        {
          name: "Buying Signals",
          href: "/signals",
          icon: Radio,
          badge: stats?.signals_proposed ? stats.signals_proposed : null,
          badgeVariant: "info",
        },
      ],
    },
    {
      title: "Outbound Engine",
      items: [
        {
          name: "Outbox Review",
          href: "/outbox",
          icon: Send,
          badge: stats?.outbox_pending ? stats.outbox_pending : null,
          badgeVariant: "warning",
        },
        {
          name: "Conversations",
          href: "/conversations",
          icon: MessageSquare,
          badge: stats?.needs_human ? stats.needs_human : stats?.open_conversations || null,
          badgeVariant: stats?.needs_human ? "destructive" : "neutral",
        },
        {
          name: "Campaigns",
          href: "/campaigns",
          icon: Layers,
        },
        {
          name: "Pitch Studio",
          href: "/outreach-prep",
          icon: PenTool,
        },
      ],
    },
    {
      title: "Operations & System",
      items: [
        {
          name: "Agent Console",
          href: "/controls",
          icon: Terminal,
        },
        {
          name: "AI Telemetry",
          href: "/usage",
          icon: BarChart3,
        },
        {
          name: "Inboxes & Health",
          href: "/inboxes",
          icon: Inbox,
        },
        {
          name: "Settings & ICP",
          href: "/settings",
          icon: Settings,
        },
      ],
    },
  ];

  const renderSidebarContent = (isCollapsed: boolean, isMobile: boolean) => (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-card/95 backdrop-blur-xl transition-all duration-200 select-none",
        isCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border transition-all",
          isCollapsed ? "justify-center px-2" : "justify-between px-3.5"
        )}
      >
        <Link
          href="/"
          onClick={isMobile ? onCloseMobile : undefined}
          className="flex items-center gap-2.5 group overflow-hidden"
          title="Outreach Home"
        >
          <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-2xs group-hover:scale-105 transition-transform">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          {!isCollapsed && (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold tracking-tight text-foreground text-sm">
                outreach
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono font-medium text-muted-foreground border border-border">
                v0.5
              </span>
            </div>
          )}
        </Link>

        {/* Mobile Close Button (shown on mobile drawer only) */}
        {isMobile && onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            title="Close menu"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Desktop Collapse Button (shown when expanded on desktop) */}
        {!isMobile && !isCollapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title="Collapse sidebar (⌘B)"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Expand Button Bar when Collapsed on Desktop */}
      {!isMobile && isCollapsed && onToggleCollapse && (
        <div className="flex justify-center py-1.5 border-b border-border/50 bg-muted/20">
          <button
            onClick={onToggleCollapse}
            title="Expand sidebar (⌘B)"
            className="flex h-6 w-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="space-y-0.5">
            {!isCollapsed && (
              <h3 className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {section.title}
              </h3>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={isMobile ? onCloseMobile : undefined}
                    title={isCollapsed ? item.name : undefined}
                    className={cn(
                      "group relative flex items-center rounded-lg text-xs font-medium transition-all duration-150 select-none",
                      isCollapsed ? "justify-center h-9 w-full" : "justify-between px-2.5 py-1.5",
                      isActive
                        ? "bg-secondary text-foreground font-semibold shadow-2xs"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      {!isCollapsed && <span className="truncate">{item.name}</span>}
                    </div>

                    {!isCollapsed && item.badge != null && (
                      <Badge
                        variant={item.badgeVariant || "neutral"}
                        size="sm"
                        className="font-mono tabular-nums px-1.5"
                      >
                        {item.badge}
                      </Badge>
                    )}

                    {isCollapsed && item.badge != null && (
                      <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Status Widget */}
      <div className="shrink-0 border-t border-border bg-muted/20 p-2">
        <Link
          href="/controls"
          onClick={isMobile ? onCloseMobile : undefined}
          className={cn(
            "flex items-center rounded-lg border border-border bg-card p-2 shadow-2xs hover:border-border/80 transition-colors",
            isCollapsed ? "justify-center" : "justify-between"
          )}
          title={isCollapsed ? (isRunning ? "Agent: Running" : "Agent: Standby") : undefined}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              {isRunning && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  isRunning ? "bg-emerald-500" : "bg-rose-500"
                )}
              />
            </span>
            {!isCollapsed && (
              <div className="flex flex-col truncate leading-tight">
                <span className="text-[11px] font-medium text-foreground truncate">
                  {isRunning ? "Agent Running" : "Standby Mode"}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono truncate">
                  {isRunning && pid ? `PID: ${pid}` : "Offline"}
                </span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <span className="text-[10px] font-medium text-muted-foreground hover:text-foreground">
              Logs →
            </span>
          )}
        </Link>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed inset-y-0 left-0 z-30">
        {renderSidebarContent(collapsed, false)}
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 animate-in slide-in-from-left duration-200">
            {renderSidebarContent(false, true)}
          </div>
        </div>
      )}
    </>
  );
}
