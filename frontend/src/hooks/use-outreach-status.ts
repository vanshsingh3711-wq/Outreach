"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { OutreachStatus, PipelineStats } from "@/lib/types";

export function useOutreachStatus() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery<OutreachStatus>({
    queryKey: ["outreach-status"],
    queryFn: () => fetchApi<OutreachStatus>("/api/outreach/status"),
    refetchInterval: 3000,
  });

  const aiStatusQuery = useQuery<{
    status: string;
    model: string;
    provider: string;
    configured: boolean;
  }>({
    queryKey: ["ai-status"],
    queryFn: () => fetchApi("/api/prospecting/ai-status"),
    refetchInterval: 10000,
  });

  const statsQuery = useQuery<PipelineStats>({
    queryKey: ["pipeline-stats"],
    queryFn: () => fetchApi<PipelineStats>("/api/stats"),
    refetchInterval: 5000,
  });

  const startMutation = useMutation({
    mutationFn: () => fetchApi("/api/outreach/start", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach-status"] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => fetchApi("/api/outreach/stop", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach-status"] });
    },
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    isRunning: statusQuery.data?.running ?? false,
    pid: statusQuery.data?.pid,
    aiStatus: aiStatusQuery.data,
    stats: statsQuery.data,
    startOutreach: startMutation.mutateAsync,
    isStarting: startMutation.isPending,
    stopOutreach: stopMutation.mutateAsync,
    isStopping: stopMutation.isPending,
    refetchStatus: statusQuery.refetch,
  };
}
