"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";

export interface TodayItem {
  key: string;
  tone: "bad" | "warn" | "info" | "good";
  title: string;
  detail: string;
  action?: string;
  tab?: string;
  url?: string;
  url_label?: string;
}

export interface TodayStats {
  companies: number;
  prospects: number;
  signals_confirmed: number;
  outbox_pending: number;
  outbox_approved: number;
  open_conversations: number;
  needs_human: number;
  signals_proposed: number;
  email_provider?: string;
  unprofiled?: number;
}

export interface TodayResponse {
  items: TodayItem[];
  stats: TodayStats;
}

export function useToday() {
  return useQuery<TodayResponse>({
    queryKey: ["today-dashboard"],
    queryFn: () => fetchApi<TodayResponse>("/api/today"),
    refetchInterval: 5000,
  });
}

