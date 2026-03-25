import { useEffect, useRef, useCallback } from 'react';
import { useAtlasStore, PRELOAD_RADIUS, MAX_IMAGE_CACHE } from '../store/atlasStore';

const API_BASE = '/static/slices';

/**
 * LRU Image Cache with explicit memory management.
 *
 * Why not just rely on browser cache?
 * - Browser cache eviction is unpredictable and we need guaranteed instant display.
 * - By holding HTMLImageElement refs, decoded bitmap stays in GPU-ready memory.
 * - We strictly cap the cache to MAX_IMAGE_CACHE entries to prevent OOM.
 *
 * Memory math: 512×512 WebP ≈ 50KB on disk, but decoded RGBA = 512*512*4 = 1MB in memory.
 * 30 images = ~30MB — well within our 150MB client RAM budget.
 */
class ImageLRUCache {
  private cache = new Map<string, HTMLImageElement>();
  private accessOrder: string[] = [];
  private maxSize: number;
  private loading = new Set<string>();

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): HTMLImageElement | undefined {
    const img = this.cache.get(key);
    if (img) {
      // Move to end (most recently used)
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      this.accessOrder.push(key);
    }
    return img;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  isLoading(key: string): boolean {
    return this.loading.has(key);
  }

  /**
   * Load an image asynchronously and store it.
   * Returns a promise that resolves when the image is decoded.
   */
  async load(key: string, url: string): Promise<HTMLImageElement> {
    if (this.cache.has(key)) return this.cache.get(key)!;
    if (this.loading.has(key)) {
      // Wait for in-flight load
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.cache.has(key)) {
            clearInterval(check);
            resolve(this.cache.get(key)!);
          }
        }, 50);
      });
    }

    this.loading.add(key);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load: ${url}`));
        img.src = url;
      });

      // Use createImageBitmap for off-main-thread decoding if available
      // (we store the HTMLImageElement since Canvas drawImage accepts it directly)

      this.evict();
      this.cache.set(key, img);
      this.accessOrder.push(key);
      return img;
    } finally {
      this.loading.delete(key);
    }
  }

  private evict() {
    while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift()!;
      const img = this.cache.get(oldest);
      if (img) {
        // Help GC: clear the src to release decoded bitmap memory
        img.src = '';
        this.cache.delete(oldest);
      }
    }
  }

  /** Current memory usage estimate in bytes */
  estimateMemory(): number {
    let total = 0;
    for (const img of this.cache.values()) {
      total += img.naturalWidth * img.naturalHeight * 4; // RGBA
    }
    return total;
  }

  get size(): number {
    return this.cache.size;
  }

  clear() {
    for (const img of this.cache.values()) {
      img.src = '';
    }
    this.cache.clear();
    this.accessOrder = [];
    this.loading.clear();
  }
}

// Singleton — shared across component re-mounts
const imageCache = new ImageLRUCache(MAX_IMAGE_CACHE);

/**
 * Hook: aggressive image preloading with LRU eviction.
 *
 * Strategy:
 * 1. Always load the current slice FIRST (highest priority).
 * 2. Then preload ±PRELOAD_RADIUS neighbors, closest first.
 * 3. On slice change, re-evaluate and preload new neighbors.
 *
 * Returns a function to synchronously get a cached image (or undefined).
 */
export function useImagePreloader() {
  const sliceIndex = useAtlasStore((s) => s.sliceIndex);
  const paths = useAtlasStore((s) => s.sliceImagePaths);
  const totalSlices = useAtlasStore((s) => s.module?.total_slices ?? 0);
  const rafRef = useRef<number>(0);

  const getImage = useCallback(
    (idx: number): HTMLImageElement | undefined => {
      const path = paths[idx];
      return path ? imageCache.get(path) : undefined;
    },
    [paths]
  );

  useEffect(() => {
    if (paths.length === 0 || totalSlices === 0) return;

    // Cancel any pending preload schedule
    cancelAnimationFrame(rafRef.current);

    const preload = async () => {
      // 1. Load current slice immediately
      const currentPath = paths[sliceIndex];
      if (currentPath && !imageCache.has(currentPath)) {
        try {
          await imageCache.load(currentPath, `${API_BASE}/${currentPath}`);
        } catch (e) {
          console.warn(`[preloader] Failed to load slice ${sliceIndex}:`, e);
        }
      }

      // 2. Preload neighbors — closest first (interleaved forward/backward)
      const toLoad: number[] = [];
      for (let d = 1; d <= PRELOAD_RADIUS; d++) {
        if (sliceIndex + d < totalSlices) toLoad.push(sliceIndex + d);
        if (sliceIndex - d >= 0) toLoad.push(sliceIndex - d);
      }

      for (const idx of toLoad) {
        const p = paths[idx];
        if (p && !imageCache.has(p) && !imageCache.isLoading(p)) {
          // Yield to main thread between loads to keep UI responsive
          await new Promise((r) => { rafRef.current = requestAnimationFrame(r); });
          try {
            await imageCache.load(p, `${API_BASE}/${p}`);
          } catch {
            // Non-critical — silently skip
          }
        }
      }
    };

    preload();

    return () => cancelAnimationFrame(rafRef.current);
  }, [sliceIndex, paths, totalSlices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't clear cache on unmount — user may navigate back
    };
  }, []);

  return { getImage, cacheStats: { size: imageCache.size, memoryMB: imageCache.estimateMemory() / (1024 * 1024) } };
}
