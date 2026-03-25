import type { Vertex } from '../types/atlas';

/**
 * Point-in-polygon test using the ray-casting algorithm.
 *
 * Casts a horizontal ray from (px, py) to the right and counts
 * the number of polygon edges it crosses. Odd count = inside.
 *
 * This works in IMAGE-SPACE coordinates. The caller must convert
 * screen coords to image coords BEFORE calling this function.
 *
 * Time complexity: O(n) where n = number of vertices.
 */
export function pointInPolygon(px: number, py: number, vertices: Vertex[]): boolean {
  const n = vertices.length;
  if (n < 3) return false;

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;

    // Does the edge from j→i straddle the horizontal line y = py?
    const intersects =
      yi > py !== yj > py &&
      // X coordinate of intersection point
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

/**
 * Convert screen (canvas-local) coordinates to image-space coordinates.
 *
 * The canvas renders the image with transform:
 *   ctx.translate(panX, panY)
 *   ctx.scale(zoom, zoom)
 *
 * So screen = image * zoom + pan
 * => image = (screen - pan) / zoom
 */
export function screenToImageCoords(
  screenX: number,
  screenY: number,
  panX: number,
  panY: number,
  zoom: number
): { x: number; y: number } {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom,
  };
}

/**
 * Compute the centroid of a polygon (for label placement).
 */
export function polygonCentroid(vertices: Vertex[]): Vertex {
  let cx = 0;
  let cy = 0;
  for (const v of vertices) {
    cx += v.x;
    cy += v.y;
  }
  return { x: cx / vertices.length, y: cy / vertices.length };
}

/**
 * Compute axis-aligned bounding box of a polygon.
 */
export function polygonBBox(vertices: Vertex[]): {
  minX: number; minY: number; maxX: number; maxY: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, minY, maxX, maxY };
}
