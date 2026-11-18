import React from "react";
import { cn } from "@/lib/utils";

export type StatusType =
  | "online"
  | "offline"
  | "warning"
  | "error"
  | "valid"
  | "risky"
  | "unknown"
  | "neutral";

export interface StatusDotProps {
  status: StatusType;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
  label?: React.ReactNode;
  className?: string;
}

export function StatusDot({
  status,
  pulse = false,
  size = "md",
  label,
  className,
}: StatusDotProps) {
  const colorMap: Record<StatusType, string> = {
    online: "bg-emerald-500",
    valid: "bg-emerald-500",
    warning: "bg-amber-500",
    risky: "bg-amber-500",
    error: "bg-rose-500",
    offline: "bg-rose-500",
    unknown: "bg-muted-foreground",
    neutral: "bg-muted-foreground",
  };

  const sizeMap = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-2.5 w-2.5",
  };

  const currentColor = colorMap[status] || colorMap.neutral;

  return (
    <span className={cn("inline-flex items-center gap-2 select-none", className)}>
      <span className={cn("relative flex shrink-0", sizeMap[size])}>
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              currentColor
            )}
          />
        )}
        <span className={cn("relative inline-flex rounded-full", sizeMap[size], currentColor)} />
      </span>
      {label && <span className="text-xs font-medium text-foreground">{label}</span>}
    </span>
  );
}
