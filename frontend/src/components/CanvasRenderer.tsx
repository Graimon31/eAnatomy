import React, { useRef, useEffect, useCallback } from 'react';
import { useAtlasStore, ZOOM_STEP } from '../store/atlasStore';
import { useImagePreloader } from '../hooks/useImagePreloader';
import { usePolygonLoader } from '../hooks/usePolygonLoader';
import {
  pointInPolygon,
  screenToImageCoords,
  polygonCentroid,
} from '../utils/geometry';
import type { Polygon } from '../types/atlas';

// ---------------------------------------------------------------------------
// Performance constants
// ---------------------------------------------------------------------------
const HOVER_THROTTLE_MS = 16; // ~60fps for hover detection

/**
 * CanvasRenderer — the core viewport component.
 *
 * Architecture:
 * - Single <canvas> element fills the viewport.
 * - On every frame (requestAnimationFrame), draws:
 *   1. Background (dark)
 *   2. The current slice image, transformed by (panX, panY, zoom)
 *   3. Polygon overlays, using the SAME transform matrix
 *   4. Labels for hovered/selected structure
 *
 * Transform math:
 *   ctx.setTransform(zoom, 0, 0, zoom, panX, panY)
 *   This means: screen_point = image_point * zoom + pan
 *   Inverse:    image_point  = (screen_point - pan) / zoom
 *
 * The key insight: by applying the same transform to both the image
 * and polygon drawing, they stay perfectly synchronized at any zoom/pan.
 */
const CanvasRenderer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastHoverCheck = useRef<number>(0);
  const mousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Store selectors (fine-grained to minimize re-renders)
  const module = useAtlasStore((s) => s.module);
  const sliceIndex = useAtlasStore((s) => s.sliceIndex);
  const zoom = useAtlasStore((s) => s.zoom);
  const panX = useAtlasStore((s) => s.panX);
  const panY = useAtlasStore((s) => s.panY);
  const hoveredPolygonId = useAtlasStore((s) => s.hoveredPolygonId);
  const selectedPolygonId = useAtlasStore((s) => s.selectedPolygonId);
  const showLabels = useAtlasStore((s) => s.showLabels);
  const polygonOpacity = useAtlasStore((s) => s.polygonOpacity);
  const polygonCache = useAtlasStore((s) => s.polygonCache);

  const {
    zoomAt,
    setIsPanning,
    setHoveredPolygon,
    setSelectedPolygon,
    nextSlice,
    prevSlice,
  } = useAtlasStore.getState();

  // Hooks
  const { getImage } = useImagePreloader();
  usePolygonLoader();

  // -------------------------------------------------------------------------
  // Resize canvas to fill container
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const parent = canvas.parentElement!;
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement!);
    return () => observer.disconnect();
  }, []);

  // -------------------------------------------------------------------------
  // Render loop
  // -------------------------------------------------------------------------
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !module) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width;
    const h = canvas.height;

    // -- Read latest state directly (avoid stale closures) --
    const state = useAtlasStore.getState();
    const { zoom, panX, panY, sliceIndex, hoveredPolygonId, selectedPolygonId, showLabels, polygonOpacity } = state;
    const polygons = state.polygonCache.get(sliceIndex) || [];
    const image = getImage(sliceIndex);

    // 1. Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // 2. Apply transform: scale by DPR first, then user pan/zoom
    //    Final transform: screen = dpr * (image * zoom + pan)
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * panX, dpr * panY);

    // 3. Draw image
    if (image && image.naturalWidth > 0) {
      ctx.drawImage(image, 0, 0, module.image_width, module.image_height);
    } else {
      // Placeholder while loading
      ctx.fillStyle = '#2a2a3e';
      ctx.fillRect(0, 0, module.image_width, module.image_height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#666';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Loading slice ${sliceIndex}...`, w / 2, h / 2);
      // Re-apply transform for polygon drawing
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * panX, dpr * panY);
    }

    // 4. Draw polygons — all in IMAGE-SPACE (transform handles screen mapping)
    for (const poly of polygons) {
      const isHovered = poly.id === hoveredPolygonId;
      const isSelected = poly.id === selectedPolygonId;
      const verts = poly.vertices;
      if (verts.length < 3) continue;

      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) {
        ctx.lineTo(verts[i].x, verts[i].y);
      }
      ctx.closePath();

      // Fill
      const alpha = isHovered ? 0.55 : isSelected ? 0.5 : polygonOpacity;
      ctx.fillStyle = hexToRGBA(poly.color, alpha);
      ctx.fill();

      // Stroke
      ctx.strokeStyle = isHovered || isSelected ? '#ffffff' : poly.color;
      ctx.lineWidth = (isHovered || isSelected ? 2.5 : 1) / zoom; // constant screen-width lines
      ctx.stroke();

      // 5. Labels
      if (showLabels && (isHovered || isSelected)) {
        const centroid = polygonCentroid(verts);
        const fontSize = Math.max(10, 14 / zoom); // constant screen-size text
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text shadow for readability
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        const pad = 4 / zoom;
        const textWidth = ctx.measureText(poly.labelEn).width;
        ctx.fillRect(
          centroid.x - textWidth / 2 - pad,
          centroid.y - fontSize / 2 - pad,
          textWidth + pad * 2,
          fontSize + pad * 2
        );

        ctx.fillStyle = '#ffffff';
        ctx.fillText(poly.labelEn, centroid.x, centroid.y);

        // Latin name below
        if (poly.labelLa) {
          const smallFont = Math.max(8, 11 / zoom);
          ctx.font = `italic ${smallFont}px sans-serif`;
          ctx.fillStyle = '#cccccc';
          ctx.fillText(poly.labelLa, centroid.x, centroid.y + fontSize * 0.9);
        }
      }
    }

    rafRef.current = requestAnimationFrame(render);
  }, [module, getImage]);

  // Start/stop render loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [render]);

  // -------------------------------------------------------------------------
  // Hit testing — find polygon under cursor
  // -------------------------------------------------------------------------
  const hitTest = useCallback(
    (canvasX: number, canvasY: number) => {
      const state = useAtlasStore.getState();
      const polygons = state.polygonCache.get(state.sliceIndex) || [];
      const imgCoords = screenToImageCoords(canvasX, canvasY, state.panX, state.panY, state.zoom);

      // Test in reverse order (top-drawn polygon = last in array has priority)
      for (let i = polygons.length - 1; i >= 0; i--) {
        const poly = polygons[i];
        if (pointInPolygon(imgCoords.x, imgCoords.y, poly.vertices)) {
          return poly;
        }
      }
      return null;
    },
    []
  );

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  /**
   * Wheel event — dual purpose:
   *   - Plain scroll → change slice (Z-axis navigation)
   *   - Ctrl + scroll → zoom in/out at cursor position
   */
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        zoomAt(factor, e.clientX, e.clientY, rect);
      } else {
        // Slice navigation
        if (e.deltaY > 0) nextSlice();
        else prevSlice();
      }
    },
    [zoomAt, nextSlice, prevSlice]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button === 0) {
        // Left click — start panning
        const state = useAtlasStore.getState();
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: state.panX,
          panY: state.panY,
        };
        setIsPanning(true);
      }
    },
    [setIsPanning]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      mousePos.current = { x: cx, y: cy };

      // Panning
      if (panStartRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        const state = useAtlasStore.getState();
        state.setPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy);
        return; // skip hover detection while panning
      }

      // Throttled hover detection
      const now = performance.now();
      if (now - lastHoverCheck.current < HOVER_THROTTLE_MS) return;
      lastHoverCheck.current = now;

      const hit = hitTest(cx, cy);
      const state = useAtlasStore.getState();
      if (hit) {
        if (hit.id !== state.hoveredPolygonId) {
          setHoveredPolygon(hit.id, hit.labelEn);
        }
      } else if (state.hoveredPolygonId) {
        setHoveredPolygon(null, null);
      }
    },
    [hitTest, setHoveredPolygon]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const wasPanning = panStartRef.current !== null;
      const movedDistance = panStartRef.current
        ? Math.hypot(e.clientX - panStartRef.current.x, e.clientY - panStartRef.current.y)
        : 0;

      panStartRef.current = null;
      setIsPanning(false);

      // If barely moved, treat as click → select polygon
      if (wasPanning && movedDistance < 5) {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
        setSelectedPolygon(hit?.id ?? null);
      }
    },
    [hitTest, setIsPanning, setSelectedPolygon]
  );

  const handleMouseLeave = useCallback(() => {
    panStartRef.current = null;
    setIsPanning(false);
    setHoveredPolygon(null, null);
  }, [setIsPanning, setHoveredPolygon]);

  // -------------------------------------------------------------------------
  // Touch events for mobile
  // -------------------------------------------------------------------------
  const touchStartRef = useRef<{ touches: Touch[]; zoom: number; panX: number; panY: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const state = useAtlasStore.getState();
    touchStartRef.current = {
      touches: Array.from(e.touches),
      zoom: state.zoom,
      panX: state.panX,
      panY: state.panY,
    };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!touchStartRef.current) return;

    const start = touchStartRef.current;

    if (e.touches.length === 1 && start.touches.length === 1) {
      // Single finger — pan
      const dx = e.touches[0].clientX - start.touches[0].clientX;
      const dy = e.touches[0].clientY - start.touches[0].clientY;
      const state = useAtlasStore.getState();
      state.setPan(start.panX + dx, start.panY + dy);
    } else if (e.touches.length === 2 && start.touches.length === 2) {
      // Pinch zoom
      const startDist = Math.hypot(
        start.touches[1].clientX - start.touches[0].clientX,
        start.touches[1].clientY - start.touches[0].clientY
      );
      const curDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      const scale = curDist / startDist;
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      zoomAt(scale / (useAtlasStore.getState().zoom / start.zoom), midX, midY, rect);
    }
  }, [zoomAt]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) {
      touchStartRef.current = null;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: hoveredPolygonId ? 'pointer' : panStartRef.current ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
};

// Utility: hex color → rgba string
function hexToRGBA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default CanvasRenderer;
