import { create } from 'zustand';
import type { Annotation } from '../api/types';

interface ViewerState {
  currentSliceIndex: number;
  currentProjectionId: number | null;
  currentModeId: number | null;
  visibleCategories: Set<string>;
  activeAnnotation: Annotation | null;
  setSliceIndex: (index: number) => void;
  setProjectionId: (id: number) => void;
  setModeId: (id: number | null) => void;
  toggleCategory: (category: string) => void;
  setActiveAnnotation: (annotation: Annotation | null) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  currentSliceIndex: 0,
  currentProjectionId: null,
  currentModeId: null,
  visibleCategories: new Set(),
  activeAnnotation: null,
  setSliceIndex: (index) => set({ currentSliceIndex: index, activeAnnotation: null }),
  setProjectionId: (id) => set({ currentProjectionId: id, currentSliceIndex: 0, activeAnnotation: null }),
  setModeId: (id) => set({ currentModeId: id }),
  toggleCategory: (category) =>
    set((state) => {
      const next = new Set(state.visibleCategories);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return { visibleCategories: next };
    }),
  setActiveAnnotation: (annotation) => set({ activeAnnotation: annotation }),
}));
