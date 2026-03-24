/**
 * Point-in-Polygon test using the Ray Casting algorithm.
 *
 * Casts a horizontal ray from (px, py) towards +X and counts
 * how many polygon edges it crosses. Odd count = inside.
 *
 * Works in image-space coordinates — caller must inverse-transform
 * screen coords before calling this.
 *
 * Time complexity: O(n) where n = number of polygon vertices.
 * For our use case (~12-20 vertices per polygon), this runs in < 0.1 ms.
 */
export function pointInPolygon(px: number, py: number, points: number[][]): boolean {
  let inside = false;
  const n = points.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];

    // Check if the ray crosses this edge
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Transform screen coordinates to image-space coordinates.
 * Inverts the canvas affine transform: translate(panX, panY) → scale(zoom).
 */
export function screenToImage(
  screenX: number,
  screenY: number,
  panX: number,
  panY: number,
  zoom: number
): [number, number] {
  return [(screenX - panX) / zoom, (screenY - panY) / zoom];
}
