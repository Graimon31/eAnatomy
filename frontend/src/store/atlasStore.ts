import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AtlasModule, Polygon } from '../types/atlas';

// ---------------------------------------------------------------------------
// Performance budget constants
// ---------------------------------------------------------------------------
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 15;       // allow up to x15 for extreme detail
export const ZOOM_STEP = 1.12;    // 12% per scroll tick — smooth and controllable
export const TARGET_FPS = 60;
export const MAX_IMAGE_CACHE = 30; // max images held in memory (~30 * 1MB = 30MB)
export const PRELOAD_RADIUS = 5;  // preload ±5 slices around current

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------
interface AtlasState {
  // Module data
  module: AtlasModule | null;
  sliceImagePaths: string[];       // indexed by sliceIndex

  // Viewport state
  sliceIndex: number;
  zoom: number;
  panX: number;                    // pan offset in screen pixels
  panY: number;

  // Interaction state
  hoveredPolygonId: string | null;
  hoveredLabel: string | null;
  selectedPolygonId: string | null;
  isPanning: boolean;
  showLabels: boolean;
  polygonOpacity: number;

  // Polygon data cache: sliceIndex → Polygon[]
  polygonCache: Map<number, Polygon[]>;

  // Actions
  setModule: (m: AtlasModule, paths: string[]) => void;
  setSliceIndex: (idx: number) => void;
  nextSlice: () => void;
  prevSlice: () => void;
  setZoom: (zoom: number) => void;
  zoomAt: (factor: number, screenX: number, screenY: number, canvasRect: DOMRect) => void;
  setPan: (x: number, y: number) => void;
  adjustPan: (dx: number, dy: number) => void;
  setIsPanning: (v: boolean) => void;
  setHoveredPolygon: (id: string | null, label: string | null) => void;
  setSelectedPolygon: (id: string | null) => void;
  cachePolygons: (sliceIndex: number, polygons: Polygon[]) => void;
  getPolygonsForSlice: (sliceIndex: number) => Polygon[] | undefined;
  toggleLabels: () => void;
  setPolygonOpacity: (v: number) => void;
  resetView: () => void;
}

export const useAtlasStore = create<AtlasState>()(
  subscribeWithSelector((set, get) => ({
    module: null,
    sliceImagePaths: [],
    sliceIndex: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    hoveredPolygonId: null,
    hoveredLabel: null,
    selectedPolygonId: null,
    isPanning: false,
    showLabels: true,
    polygonOpacity: 0.35,
    polygonCache: new Map(),

    setModule: (m, paths) => set({ module: m, sliceImagePaths: paths, sliceIndex: 0, zoom: 1, panX: 0, panY: 0 }),

    setSliceIndex: (idx) => {
      const { module } = get();
      if (!module) return;
      const clamped = Math.max(0, Math.min(module.total_slices - 1, idx));
      set({ sliceIndex: clamped, hoveredPolygonId: null, hoveredLabel: null });
    },

    nextSlice: () => {
      const { sliceIndex, module } = get();
      if (module && sliceIndex < module.total_slices - 1) {
        set({ sliceIndex: sliceIndex + 1, hoveredPolygonId: null, hoveredLabel: null });
      }
    },

    prevSlice: () => {
      const { sliceIndex } = get();
      if (sliceIndex > 0) {
        set({ sliceIndex: sliceIndex - 1, hoveredPolygonId: null, hoveredLabel: null });
      }
    },

    setZoom: (zoom) => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),

    /**
     * Zoom toward/away from a specific screen point.
     * This keeps the point under the cursor fixed in place — essential UX for map-like navigation.
     *
     * Math: After scaling by factor `f` around screen point (sx, sy),
     * the new pan must be: pan' = sx - f * (sx - pan)
     * Derivation: the image-space point under (sx, sy) is (sx - panX) / zoom.
     * After zoom' = zoom * f, we need pan' such that (sx - pan') / zoom' = same image point.
     * => pan' = sx - zoom' * (sx - panX) / zoom = sx - f * (sx - panX).
     */
    zoomAt: (factor, screenX, screenY, canvasRect) => {
      const { zoom, panX, panY } = get();
      // Convert screen coords to canvas-local coords
      const cx = screenX - canvasRect.left;
      const cy = screenY - canvasRect.top;

      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
      const actualFactor = newZoom / zoom;

      set({
        zoom: newZoom,
        panX: cx - actualFactor * (cx - panX),
        panY: cy - actualFactor * (cy - panY),
      });
    },

    setPan: (x, y) => set({ panX: x, panY: y }),
    adjustPan: (dx, dy) => set((s) => ({ panX: s.panX + dx, panY: s.panY + dy })),
    setIsPanning: (v) => set({ isPanning: v }),

    setHoveredPolygon: (id, label) => set({ hoveredPolygonId: id, hoveredLabel: label }),
    setSelectedPolygon: (id) => set({ selectedPolygonId: id }),

    cachePolygons: (sliceIndex, polygons) => {
      set((s) => {
        const next = new Map(s.polygonCache);
        next.set(sliceIndex, polygons);

        // Evict old entries if cache grows beyond limit (LRU-ish: remove furthest from current slice)
        if (next.size > 60) {
          const current = s.sliceIndex;
          const keys = [...next.keys()].sort(
            (a, b) => Math.abs(b - current) - Math.abs(a - current)
          );
          while (next.size > 40) {
            const evict = keys.shift();
            if (evict !== undefined) next.delete(evict);
          }
        }
        return { polygonCache: next };
      });
    },

    getPolygonsForSlice: (sliceIndex) => get().polygonCache.get(sliceIndex),

    toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
    setPolygonOpacity: (v) => set({ polygonOpacity: v }),

    resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
  }))
);
