import { useEffect, useRef } from 'react';
import { useAtlasStore, PRELOAD_RADIUS } from '../store/atlasStore';
import type { SlicePolygonsResponse } from '../types/atlas';

const API_BASE = '/api/polygons';

/**
 * Hook: loads polygon data for the current slice and prefetches neighbors.
 *
 * Uses the batch endpoint to minimize network round-trips.
 * Polygon JSON for 20 slices with ~30 structures each ≈ 500KB compressed.
 */
export function usePolygonLoader() {
  const moduleId = useAtlasStore((s) => s.module?.id);
  const sliceIndex = useAtlasStore((s) => s.sliceIndex);
  const cachePolygons = useAtlasStore((s) => s.cachePolygons);
  const getPolygonsForSlice = useAtlasStore((s) => s.getPolygonsForSlice);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!moduleId) return;

    // Abort previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const load = async () => {
      // Check which slices in the window need loading
      const from = Math.max(0, sliceIndex - PRELOAD_RADIUS);
      const to = sliceIndex + PRELOAD_RADIUS;

      // If current slice already cached, we might still need neighbors
      const needsBatch = [];
      for (let i = from; i <= to; i++) {
        if (!getPolygonsForSlice(i)) needsBatch.push(i);
      }

      if (needsBatch.length === 0) return;

      const batchFrom = Math.min(...needsBatch);
      const batchTo = Math.max(...needsBatch);

      try {
        const res = await fetch(
          `${API_BASE}/${moduleId}/batch?from=${batchFrom}&to=${batchTo}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json() as {
          slices: Record<string, SlicePolygonsResponse['polygons']>;
        };

        // Populate cache for each slice
        for (const [idx, polygons] of Object.entries(data.slices)) {
          cachePolygons(parseInt(idx, 10), polygons);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return; // expected
        console.warn('[polygonLoader] fetch failed:', err);

        // Fallback: load just the current slice individually
        try {
          const res = await fetch(
            `${API_BASE}/${moduleId}/${sliceIndex}`,
            { signal: controller.signal }
          );
          if (res.ok) {
            const data = await res.json() as SlicePolygonsResponse;
            cachePolygons(sliceIndex, data.polygons);
          }
        } catch {
          // give up silently
        }
      }
    };

    load();

    return () => controller.abort();
  }, [moduleId, sliceIndex, cachePolygons, getPolygonsForSlice]);
}
