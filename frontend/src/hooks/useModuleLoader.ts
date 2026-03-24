import { useEffect } from "react";
import { useAtlasStore } from "@/store/atlasStore";
import type { Module, SliceInfo, PolygonData } from "@/types/atlas";
import {
  generateDemoModule,
  generateDemoSlices,
  generateDemoPolygonData,
  generateSliceImage,
} from "@/utils/demoData";

const API_BASE = "/api";
const USE_DEMO = import.meta.env.VITE_DEMO === "true" || true; // Default to demo mode

/**
 * Loads module data — either from the API or from synthetic demo data.
 * Demo mode generates procedural MRI-like images and polygon overlays
 * so the frontend can run standalone without a backend.
 */
export function useModuleLoader(slug: string) {
  const setModule = useAtlasStore((s) => s.setModule);
  const setSlices = useAtlasStore((s) => s.setSlices);
  const setPolygonData = useAtlasStore((s) => s.setPolygonData);
  const setSliceIndex = useAtlasStore((s) => s.setSliceIndex);

  useEffect(() => {
    let cancelled = false;

    async function loadFromAPI() {
      try {
        const [modRes, slicesRes, polyRes] = await Promise.all([
          fetch(`${API_BASE}/modules/${slug}`),
          fetch(`${API_BASE}/modules/${slug}/slices`),
          fetch(`${API_BASE}/modules/${slug}/polygons`),
        ]);
        if (cancelled) return;
        if (!modRes.ok || !slicesRes.ok || !polyRes.ok) {
          console.error("Failed to load module data, falling back to demo");
          loadDemo();
          return;
        }
        const mod: Module = await modRes.json();
        const slices: SliceInfo[] = await slicesRes.json();
        const polyData: PolygonData = await polyRes.json();
        if (cancelled) return;
        setModule(mod);
        setSlices(slices);
        setPolygonData(polyData);
        setSliceIndex(Math.floor(slices.length / 2));
      } catch {
        console.error("API unavailable, falling back to demo");
        loadDemo();
      }
    }

    function loadDemo() {
      if (cancelled) return;
      const mod = generateDemoModule();
      const slices = generateDemoSlices();
      const polyData = generateDemoPolygonData();

      // Pre-generate all slice images as data URLs
      const generatedSlices: SliceInfo[] = slices.map((s) => ({
        ...s,
        imagePath: generateSliceImage(s.sliceIndex),
      }));

      setModule(mod);
      setSlices(generatedSlices);
      setPolygonData(polyData);
      setSliceIndex(Math.floor(generatedSlices.length / 2));
    }

    if (USE_DEMO) {
      loadDemo();
    } else {
      loadFromAPI();
    }

    return () => { cancelled = true; };
  }, [slug, setModule, setSlices, setPolygonData, setSliceIndex]);
}
