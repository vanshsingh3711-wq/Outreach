import React from "react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    neutral?: boolean;
  };
  badge?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  badge,
  className,
  onClick,
}: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border bg-card p-5 text-card-foreground shadow-2xs transition-all",
        onClick && "cursor-pointer hover:border-border/80 hover:bg-card/80 active:scale-[0.99]",
        className
      )}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
        <span className="truncate">{title}</span>
        {icon && <span className="text-muted-foreground/70 shrink-0">{icon}</span>}
        {badge && !icon && <span>{badge}</span>}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-semibold tracking-tight text-foreground font-mono tabular-nums">
          {value}
        </div>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium border",
              trend.neutral
                ? "border-border bg-muted text-muted-foreground"
                : trend.isPositive
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-[11px] text-muted-foreground truncate">{subtitle}</p>
      )}
    </div>
  );
}
