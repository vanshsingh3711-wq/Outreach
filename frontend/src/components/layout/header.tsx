"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useOutreachStatus } from "@/hooks/use-outreach-status";
import { useTheme } from "@/hooks/use-theme";
import { Play, Square, RefreshCw, Cpu, Sun, Moon, Monitor, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();
  const { isRunning, startOutreach, stopOutreach, isStarting, isStopping, refetchStatus, aiStatus } =
    useOutreachStatus();
  const { theme, setTheme } = useTheme();

  // Generate readable title from pathname
  const getPageTitle = () => {
    if (pathname === "/") return "Today";
    const segment = pathname.split("/").filter(Boolean)[0] || "";
    return segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-6 backdrop-blur-xl transition-all">
      {/* Left: Mobile Toggle & Page Context */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:text-white lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white tracking-tight">
            {getPageTitle()}
          </span>
          <span className="text-slate-600">/</span>
          <div className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/60 px-2.5 py-0.5 text-[11px] text-slate-400 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>:5555</span>
          </div>
        </div>

        {aiStatus && (
          <div className="hidden md:flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-300">
            <Cpu className="h-3 w-3 text-indigo-400" />
            <span>DeepSeek {aiStatus.model || "chat"}</span>
          </div>
        )}
      </div>

      {/* Right: Controls & Appearance Toggle */}
      <div className="flex items-center gap-2.5">
        {/* Appearance Switcher */}
        <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/60 p-1">
          <button
            onClick={() => setTheme("light")}
            title="Light mode"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition",
              theme === "light"
                ? "bg-slate-800 text-amber-300 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Sun className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setTheme("dark")}
            title="Dark mode"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition",
              theme === "dark"
                ? "bg-slate-800 text-sky-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Moon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setTheme("auto")}
            title="Match system"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition",
              theme === "auto"
                ? "bg-slate-800 text-emerald-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          onClick={() => refetchStatus()}
          title="Refresh metrics"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>

        {isRunning ? (
          <button
            onClick={() => stopOutreach()}
            disabled={isStopping}
            className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <Square className="h-3 w-3 fill-rose-400" />
            <span className="hidden sm:inline">{isStopping ? "Stopping..." : "Stop Engine"}</span>
          </button>
        ) : (
          <button
            onClick={() => startOutreach()}
            disabled={isStarting}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 transition disabled:opacity-50 cursor-pointer shadow-sm shadow-emerald-500/10"
          >
            <Play className="h-3 w-3 fill-emerald-400" />
            <span className="hidden sm:inline">{isStarting ? "Starting..." : "Start Engine"}</span>
          </button>
        )}
      </div>
    </header>
  );
}
