import { useEffect, useRef, useCallback } from "react";
import type { SliceInfo } from "@/types/atlas";

// ─── LRU Image Cache ─────────────────────────────────────────────────────────
// Prevents memory leaks by capping the number of decoded HTMLImageElement
// objects held in memory. Uses a Map (insertion-order-aware) as a simple LRU:
// accessing an entry moves it to the end; eviction pops from the front.

const MAX_CACHED = 30; // ~30 × 512×512×4 bytes ≈ 30 MB decoded pixel data

class ImageLRUCache {
  private cache = new Map<string, HTMLImageElement>();
  private loading = new Set<string>();

  get(key: string): HTMLImageElement | undefined {
    const img = this.cache.get(key);
    if (img) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, img);
    }
    return img;
  }

  set(key: string, img: HTMLImageElement): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, img);
    this.evict();
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  isLoading(key: string): boolean {
    return this.loading.has(key);
  }

  setLoading(key: string): void {
    this.loading.add(key);
  }

  clearLoading(key: string): void {
    this.loading.delete(key);
  }

  get size(): number {
    return this.cache.size;
  }

  private evict(): void {
    while (this.cache.size > MAX_CACHED) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        const img = this.cache.get(oldest);
        if (img) {
          // Release decoded pixel data — critical for memory reclamation
          img.src = "";
        }
        this.cache.delete(oldest);
      }
    }
  }

  /** Evict entries not in the given set of keys */
  retainOnly(keys: Set<string>): void {
    for (const k of this.cache.keys()) {
      if (!keys.has(k)) {
        const img = this.cache.get(k);
        if (img) img.src = "";
        this.cache.delete(k);
      }
    }
  }

  destroy(): void {
    for (const img of this.cache.values()) {
      img.src = "";
    }
    this.cache.clear();
    this.loading.clear();
  }
}

// ─── Preloader Hook ──────────────────────────────────────────────────────────
// On every slice change, preloads [current - AHEAD, current + AHEAD] images
// and garbage-collects images outside this window.

const PRELOAD_AHEAD = 5;

export function useImagePreloader(slices: SliceInfo[], currentIndex: number) {
  const cacheRef = useRef(new ImageLRUCache());

  // Cleanup on unmount
  useEffect(() => {
    const cache = cacheRef.current;
    return () => cache.destroy();
  }, []);

  // Preload on index change
  useEffect(() => {
    if (slices.length === 0) return;
    const cache = cacheRef.current;

    const lo = Math.max(0, currentIndex - PRELOAD_AHEAD);
    const hi = Math.min(slices.length - 1, currentIndex + PRELOAD_AHEAD);
    const desiredKeys = new Set<string>();

    for (let i = lo; i <= hi; i++) {
      const path = slices[i].imagePath;
      desiredKeys.add(path);

      if (cache.has(path) || cache.isLoading(path)) continue;

      cache.setLoading(path);
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        cache.clearLoading(path);
        cache.set(path, img);
      };
      img.onerror = () => {
        cache.clearLoading(path);
      };
      img.src = path;
    }

    // Evict images far from the current position
    cache.retainOnly(desiredKeys);
  }, [slices, currentIndex]);

  /** Synchronous cache lookup — returns null if not yet loaded */
  const getImage = useCallback(
    (path: string): HTMLImageElement | null => {
      return cacheRef.current.get(path) ?? null;
    },
    []
  );

  return { getImage };
}
