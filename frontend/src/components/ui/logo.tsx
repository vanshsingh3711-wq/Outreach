"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  version?: string;
}

export function Logo({
  size = 28,
  className,
  showWordmark = false,
  version,
}: LogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <div
        className="relative shrink-0 flex items-center justify-center rounded-lg transition-transform hover:scale-105"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-xs"
        >
          <defs>
            <linearGradient id="outreach-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          {/* Outer radar ripple */}
          <circle
            cx="24"
            cy="24"
            r="22"
            stroke="url(#outreach-brand-grad)"
            strokeWidth="3"
            opacity="0.35"
          />
          {/* Middle radar circle */}
          <circle
            cx="24"
            cy="24"
            r="14"
            stroke="url(#outreach-brand-grad)"
            strokeWidth="3"
            opacity="0.75"
          />
          {/* Center core pulse */}
          <circle cx="24" cy="24" r="6" fill="url(#outreach-brand-grad)" />
          {/* Directional radar chevron / arrow */}
          <path
            d="M24 10 L38 24 L24 38"
            stroke="url(#outreach-brand-grad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {showWordmark && (
        <div className="flex items-center gap-1.5 truncate leading-none">
          <span className="font-semibold tracking-tight text-foreground text-sm font-sans">
            outreach
          </span>
          {version && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono font-medium text-muted-foreground border border-border">
              {version}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
