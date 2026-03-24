import { useRef, useEffect, useCallback } from "react";
import { useAtlasStore } from "@/store/atlasStore";
import { useImagePreloader } from "@/hooks/useImagePreloader";
import { pointInPolygon, screenToImage } from "@/utils/geometry";
import type { Polygon, Structure } from "@/types/atlas";

// ─── Canvas Renderer ─────────────────────────────────────────────────────────
// Renders: (1) the medical image slice, (2) polygon overlays, (3) hover highlights.
// All drawing uses the same affine transform so polygons track the image perfectly.

const SLICE_DEBOUNCE_MS = 30;
const HOVER_HIGHLIGHT_FILL = "rgba(255, 255, 0, 0.35)";
const SELECTED_HIGHLIGHT_FILL = "rgba(0, 150, 255, 0.4)";

export function CanvasRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const sliceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── State selectors (granular to minimize re-renders) ──
  const slices = useAtlasStore((s) => s.slices);
  const sliceIndex = useAtlasStore((s) => s.sliceIndex);
  const zoom = useAtlasStore((s) => s.zoom);
  const panX = useAtlasStore((s) => s.panX);
  const panY = useAtlasStore((s) => s.panY);
  const polygonData = useAtlasStore((s) => s.polygonData);
  const hoveredPolygonId = useAtlasStore((s) => s.hoveredPolygonId);
  const selectedStructureId = useAtlasStore((s) => s.selectedStructureId);
  const showLabels = useAtlasStore((s) => s.showLabels);

  const {
    changeSlice, zoomAtPoint, deltaPan, setIsPanning,
    setHoveredPolygonId, setSelectedStructureId,
  } = useAtlasStore.getState();

  const { getImage } = useImagePreloader(slices, sliceIndex);

  // ── Build structure lookup map ──
  const structMap = useRef(new Map<number, Structure>());
  useEffect(() => {
    structMap.current.clear();
    if (polygonData) {
      for (const s of polygonData.structures) {
        structMap.current.set(s.id, s);
      }
    }
  }, [polygonData]);

  // ── Get polygons for current slice ──
  const getCurrentPolygons = useCallback((): Polygon[] => {
    if (!polygonData) return [];
    return polygonData.slices[String(sliceIndex)] ?? [];
  }, [polygonData, sliceIndex]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ══════════════════════════════════════════════════════════════════════════

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const currentSlice = slices[sliceIndex];
    const store = useAtlasStore.getState();

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Dark background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // ── Apply affine transform ──────────────────────────────────
    // All subsequent drawing is in image-space.
    // Transform: screen = translate(panX, panY) → scale(zoom) → image
    ctx.save();
    ctx.translate(store.panX, store.panY);
    ctx.scale(store.zoom, store.zoom);

    // ── Draw image ──────────────────────────────────────────────
    if (currentSlice) {
      const img = getImage(currentSlice.imagePath);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, currentSlice.width, currentSlice.height);
      } else {
        // Placeholder while loading
        ctx.fillStyle = "#2d2d44";
        ctx.fillRect(0, 0, currentSlice?.width ?? 512, currentSlice?.height ?? 512);
        ctx.fillStyle = "#666";
        ctx.font = "16px monospace";
        ctx.fillText("Loading slice...", 180, 260);
      }
    }

    // ── Draw polygons ───────────────────────────────────────────
    const polys = getCurrentPolygons();
    for (const poly of polys) {
      const struct = structMap.current.get(poly.structureId);
      if (!struct) continue;

      const isHovered = poly.structureId === store.hoveredPolygonId;
      const isSelected = poly.structureId === store.selectedStructureId;

      ctx.beginPath();
      const pts = poly.points;
      if (pts.length === 0) continue;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.closePath();

      // Fill
      if (isSelected) {
        ctx.fillStyle = SELECTED_HIGHLIGHT_FILL;
        ctx.fill();
      } else if (isHovered) {
        ctx.fillStyle = HOVER_HIGHLIGHT_FILL;
        ctx.fill();
      } else if (store.showLabels) {
        ctx.fillStyle = struct.color;
        ctx.globalAlpha = 0.15;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Stroke
      ctx.strokeStyle = isHovered || isSelected ? "#fff" : struct.color;
      ctx.lineWidth = (isHovered || isSelected ? 2.5 : 1) / store.zoom; // constant visual thickness
      ctx.stroke();

      // Label
      if (store.showLabels && (isHovered || isSelected)) {
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const fontSize = Math.max(10, 14 / store.zoom);
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3 / store.zoom;
        ctx.strokeText(struct.nameEn, cx, cy);
        ctx.fillText(struct.nameEn, cx, cy);
      }
    }

    ctx.restore();

    // ── HUD overlay (screen-space) ──────────────────────────────
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(8, 8, 220, 60);
    ctx.fillStyle = "#eee";
    ctx.font = "13px monospace";
    ctx.fillText(`Slice: ${sliceIndex + 1} / ${slices.length}`, 16, 28);
    ctx.fillText(`Zoom: ${(store.zoom * 100).toFixed(0)}%`, 16, 46);
    ctx.fillText(`Pan: (${store.panX.toFixed(0)}, ${store.panY.toFixed(0)})`, 16, 62);
  }, [slices, sliceIndex, getImage, getCurrentPolygons, showLabels, hoveredPolygonId, selectedStructureId, zoom, panX, panY]);

  // ── Schedule render on every relevant state change ──
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [render]);

  // ── Resize canvas to fill container ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(devicePixelRatio, devicePixelRatio);
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(render);
      }
    });
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, [render]);

  // ══════════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Wheel handler — multiplexed:
   * - Ctrl + Wheel → zoom at cursor position
   * - Wheel alone  → change slice (debounced)
   */
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      // Zoom towards cursor
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      zoomAtPoint(factor, x, y);
    } else {
      // Change slice with debounce
      clearTimeout(sliceTimerRef.current);
      sliceTimerRef.current = setTimeout(() => {
        changeSlice(e.deltaY > 0 ? 1 : -1);
      }, SLICE_DEBOUNCE_MS);
    }
  }, [zoomAtPoint, changeSlice]);

  /** Pointer down → start panning */
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // LMB only
    setIsPanning(true);
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    canvasRef.current?.setPointerCapture(e.pointerId);
  }, [setIsPanning]);

  /** Pointer move → pan or hit-test */
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const store = useAtlasStore.getState();
    const rect = canvasRef.current!.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (store.isPanning && e.buttons === 1) {
      // Pan
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      deltaPan(dx, dy);
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Hit-test polygons in image-space
    const [imgX, imgY] = screenToImage(screenX, screenY, store.panX, store.panY, store.zoom);
    const polys = store.polygonData?.slices[String(store.sliceIndex)] ?? [];
    let hitId: number | null = null;

    // Iterate in reverse so topmost polygon wins
    for (let i = polys.length - 1; i >= 0; i--) {
      if (pointInPolygon(imgX, imgY, polys[i].points)) {
        hitId = polys[i].structureId;
        break;
      }
    }

    if (hitId !== store.hoveredPolygonId) {
      setHoveredPolygonId(hitId);
    }
  }, [deltaPan, setHoveredPolygonId]);

  /** Pointer up → stop panning / select structure */
  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const store = useAtlasStore.getState();
    setIsPanning(false);
    canvasRef.current?.releasePointerCapture(e.pointerId);

    // If pointer barely moved, treat as click → select hovered structure
    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;
    if (Math.hypot(dx, dy) < 5 && store.hoveredPolygonId) {
      setSelectedStructureId(
        store.selectedStructureId === store.hoveredPolygonId
          ? null
          : store.hoveredPolygonId
      );
    }
  }, [setIsPanning, setSelectedStructureId]);

  return (
    <canvas
      ref={canvasRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        setIsPanning(false);
        setHoveredPolygonId(null);
      }}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        cursor: useAtlasStore.getState().isPanning ? "grabbing" : "crosshair",
        touchAction: "none", // prevent browser gestures
      }}
    />
  );
}
