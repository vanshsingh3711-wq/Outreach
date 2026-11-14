"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOutreachStatus } from "@/hooks/use-outreach-status";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Home,
  Building2,
  Inbox,
  Mail,
  MessageSquare,
  Sparkles,
  Search,
  Users,
  PenTool,
  Radio,
  Layers,
  Send,
  Activity,
  BarChart3,
  Sliders,
  Settings,
  Lock,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: number | string | null;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const { status, isRunning, pid } = useOutreachStatus();
  const { logout } = useAuth();

  const sections: NavSection[] = [
    {
      title: "Work",
      items: [
        { name: "Today", href: "/", icon: Home },
        { name: "Your Company", href: "/company", icon: Building2 },
        { name: "Outbox", href: "/outbox", icon: Send },
        { name: "Inboxes", href: "/inboxes", icon: Inbox },
        { name: "Conversations", href: "/conversations", icon: MessageSquare },
      ],
    },
    {
      title: "AI Prospecting",
      items: [
        { name: "ICP Discovery", href: "/discovery", icon: Sparkles },
        { name: "URL Enrichment", href: "/discovery/enrich", icon: Search },
        { name: "Decision-Makers", href: "/decision-makers", icon: Users },
        { name: "Outreach Prep", href: "/outreach-prep", icon: PenTool },
      ],
    },
    {
      title: "Pipeline",
      items: [
        { name: "Signals", href: "/signals", icon: Radio },
        { name: "Companies", href: "/companies", icon: Layers },
        { name: "Contacts", href: "/prospects", icon: Mail },
        { name: "Campaigns", href: "/campaigns", icon: ChevronRight },
      ],
    },
    {
      title: "System",
      items: [
        { name: "Activity", href: "/activity", icon: Activity },
        { name: "Usage", href: "/usage", icon: BarChart3 },
        { name: "Controls", href: "/controls", icon: Sliders },
        { name: "Settings", href: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800/80 px-5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-500 shadow-lg shadow-sky-500/20 ring-1 ring-white/10 group-hover:scale-105 transition-transform">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 font-bold tracking-tight text-white text-base">
              <span>outreach</span>
              <span className="rounded bg-sky-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-400 ring-1 ring-sky-500/20">
                v0.5
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Autonomous AI Outbound</span>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <h3 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </h3>
            <div className="space-y-0.5 pt-1">
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
                    className={cn(
                      "group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150",
                      isActive
                        ? "bg-sky-500/15 text-sky-300 font-semibold shadow-sm ring-1 ring-sky-500/30"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-sky-400"
                            : "text-slate-500 group-hover:text-slate-300"
                        )}
                      />
                      <span>{item.name}</span>
                    </div>
                    {item.badge != null && (
                      <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Status & Auth */}
      <div className="shrink-0 border-t border-slate-800/80 bg-slate-950/50 p-3">
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              {isRunning && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-2.5 w-2.5 rounded-full",
                  isRunning ? "bg-emerald-500" : "bg-rose-500"
                )}
              />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-200">
                {isRunning ? "Agent Running" : "Agent Stopped"}
              </span>
              <span className="text-[10px] text-slate-400">
                {isRunning && pid ? `PID: ${pid}` : "Standby mode"}
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            title="Lock Dashboard"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            <Lock className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
