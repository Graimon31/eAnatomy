import { create } from "zustand";
import type { Module, SliceInfo, PolygonData, Structure } from "@/types/atlas";

// ─── Zustand State Store ─────────────────────────────────────────────────────
// Single source of truth for the entire atlas viewer.
// Deliberately flat for O(1) access; no nested selectors needed.

interface AtlasState {
  // Module data
  module: Module | null;
  slices: SliceInfo[];
  polygonData: PolygonData | null;

  // Viewport state
  sliceIndex: number;
  zoom: number;
  panX: number;
  panY: number;

  // Interaction state
  hoveredPolygonId: number | null; // structureId
  selectedStructureId: number | null;
  isPanning: boolean;
  showLabels: boolean;

  // Actions
  setModule: (m: Module) => void;
  setSlices: (s: SliceInfo[]) => void;
  setPolygonData: (d: PolygonData) => void;
  setSliceIndex: (i: number) => void;
  changeSlice: (delta: number) => void;
  setZoom: (z: number, anchorX?: number, anchorY?: number) => void;
  zoomAtPoint: (factor: number, screenX: number, screenY: number) => void;
  setPan: (x: number, y: number) => void;
  deltaPan: (dx: number, dy: number) => void;
  setHoveredPolygonId: (id: number | null) => void;
  setSelectedStructureId: (id: number | null) => void;
  setIsPanning: (v: boolean) => void;
  toggleLabels: () => void;
  resetView: () => void;

  // Derived
  getHoveredStructure: () => Structure | null;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 10;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

export const useAtlasStore = create<AtlasState>((set, get) => ({
  module: null,
  slices: [],
  polygonData: null,
  sliceIndex: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  hoveredPolygonId: null,
  selectedStructureId: null,
  isPanning: false,
  showLabels: true,

  setModule: (m) => set({ module: m }),
  setSlices: (s) => set({ slices: s }),
  setPolygonData: (d) => set({ polygonData: d }),
  setSliceIndex: (i) => {
    const max = get().slices.length - 1;
    set({ sliceIndex: Math.max(0, Math.min(max, i)) });
  },
  changeSlice: (delta) => {
    const { sliceIndex, slices } = get();
    const next = sliceIndex + delta;
    if (next >= 0 && next < slices.length) {
      set({ sliceIndex: next });
    }
  },

  setZoom: (z) => set({ zoom: clampZoom(z) }),

  /**
   * Zoom towards a screen-space anchor point.
   * This keeps the point under the cursor stationary during zoom —
   * critical for intuitive Ctrl+Wheel zoom behavior.
   *
   * Math: newPan = anchor - (anchor - oldPan) * (newZoom / oldZoom)
   */
  zoomAtPoint: (factor, screenX, screenY) => {
    const { zoom, panX, panY } = get();
    const newZoom = clampZoom(zoom * factor);
    const ratio = newZoom / zoom;
    set({
      zoom: newZoom,
      panX: screenX - (screenX - panX) * ratio,
      panY: screenY - (screenY - panY) * ratio,
    });
  },

  setPan: (x, y) => set({ panX: x, panY: y }),
  deltaPan: (dx, dy) => set((s) => ({ panX: s.panX + dx, panY: s.panY + dy })),

  setHoveredPolygonId: (id) => set({ hoveredPolygonId: id }),
  setSelectedStructureId: (id) => set({ selectedStructureId: id }),
  setIsPanning: (v) => set({ isPanning: v }),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),

  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),

  getHoveredStructure: () => {
    const { hoveredPolygonId, polygonData } = get();
    if (!hoveredPolygonId || !polygonData) return null;
    return polygonData.structures.find((s) => s.id === hoveredPolygonId) ?? null;
  },
}));
