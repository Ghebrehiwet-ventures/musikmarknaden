import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { getAdDetails, Ad } from "@/lib/api";

export function usePrefetchAdDetails() {
  const queryClient = useQueryClient();
  const hoverTimeoutRef = useRef<number | null>(null);
  const prefetchedUrls = useRef<Set<string>>(new Set());

  const prefetch = useCallback((ad: Ad) => {
    // Skip if already prefetched or already in cache
    if (prefetchedUrls.current.has(ad.ad_url)) return;
    
    const cachedData = queryClient.getQueryData(["ad-details", ad.ad_url]);
    if (cachedData) return;

    prefetchedUrls.current.add(ad.ad_url);
    
    queryClient.prefetchQuery({
      queryKey: ["ad-details", ad.ad_url],
      queryFn: () => getAdDetails(ad.ad_url),
      staleTime: 24 * 60 * 60 * 1000,
      gcTime: 7 * 24 * 60 * 60 * 1000,
    });
  }, [queryClient]);

  const startHoverPrefetch = useCallback((ad: Ad) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Start prefetch after 300ms hover
    hoverTimeoutRef.current = window.setTimeout(() => {
      prefetch(ad);
    }, 300);
  }, [prefetch]);

  const cancelHoverPrefetch = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  return { startHoverPrefetch, cancelHoverPrefetch, prefetch };
}
