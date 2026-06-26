/** Shared React Query options for admin/manager dashboards that should stay up to date. */
export const LIVE_STATS_QUERY_OPTIONS = {
  refetchInterval: 30_000,
  refetchOnWindowFocus: true,
  staleTime: 15_000,
} as const;
