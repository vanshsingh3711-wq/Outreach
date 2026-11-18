"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  variant?: "pill" | "underline";
  className?: string;
}

export function Tabs({
  items,
  value,
  onChange,
  variant = "pill",
  className,
}: TabsProps) {
  if (variant === "underline") {
    return (
      <div className={cn("flex items-center space-x-1 border-b border-border", className)}>
        {items.map((tab) => {
          const isActive = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "group relative flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors cursor-pointer select-none",
                isActive
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon && (
                <span
                  className={cn(
                    "h-3.5 w-3.5 transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground border border-border">
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary rounded-t-sm" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Pill variant (default)
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-muted/40 p-1 text-muted-foreground",
        className
      )}
    >
      {items.map((tab) => {
        const isActive = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium transition-all select-none cursor-pointer",
              isActive
                ? "bg-card text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.icon && (
              <span
                className={cn(
                  "h-3.5 w-3.5 transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-medium border",
                  isActive
                    ? "bg-muted text-foreground border-border"
                    : "bg-muted/80 text-muted-foreground border-transparent"
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
