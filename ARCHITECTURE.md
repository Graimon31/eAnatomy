# eAnatomy — Interactive Anatomy Atlas MVP

## 1. System Analysis

### Scroll Mechanics & Slice Navigation

The atlas displays medical imaging slices (CT/MRI) along the Z-axis. The core interaction model:

| Input | Action | Implementation |
|-------|--------|----------------|
| Mouse wheel (no modifier) | Navigate Z-axis (change slice) | `sliceIndex ± 1`, triggers image preloader |
| Ctrl + Mouse wheel | Zoom at cursor position | `zoom *= 1.12^n`, with pivot-point math |
| Left mouse drag | Pan the viewport | `panX += dx, panY += dy` |
| Hover over canvas | Hit-test polygons | Ray-casting in image-space coords |
| Click | Select structure | Sets `selectedPolygonId` in store |

**Z-index ↔ Caching relationship:**
- When `sliceIndex` changes, the `useImagePreloader` hook loads the new image and ±5 neighbors.
- The `usePolygonLoader` hook batch-fetches polygon data for ±5 slices via a single HTTP request.
- Both caches use LRU eviction: images capped at 30 entries (~30MB decoded RGBA), polygons at 60 slices.
- The vector polygon layer is drawn with the SAME `ctx.setTransform()` as the raster image, guaranteeing pixel-perfect sync at all zoom/pan states.

### Performance Budgets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Render FPS | 60fps | requestAnimationFrame loop; single Canvas composite |
| Client RAM | < 150 MB | 30 images × ~1MB decoded + polygon JSON < 20MB |
| Hover response | < 16ms | Throttled to animation frame; O(n) ray-cast over ~30 polygons/slice |
| Slice switch latency | < 100ms | Preloaded images are cache hits; instant `drawImage` |
| Initial polygon load | < 500ms | Batch endpoint + gzip compression (5MB → ~500KB) |

## 2. Architecture

### Database Schema (PostgreSQL)

```
atlas_modules  →  slices (1:N, by module_id + slice_index)
atlas_modules  →  structures (1:N, anatomical labels)
structures     →  polygons (1:N, per-slice polygon geometry)
```

Key design decisions:
- **Vertices as JSONB**: `[{x,y}, ...]` in image-pixel coordinates. Simple, no PostGIS needed for this use case.
- **Composite index** on `(structure_id, slice_index)` — the hot query path.
- **Denormalized view** `v_slice_polygons` joins structure metadata with polygon data for single-query API responses.

### REST API Contracts

```
GET /api/modules
  → AtlasModule[]

GET /api/modules/:slugOrId
  → AtlasModule

GET /api/slices/:moduleId
  → { moduleId, slices: [{slice_index, image_path}] }

GET /api/polygons/:moduleId/:sliceIndex
  → { moduleId, sliceIndex, count, polygons: Polygon[] }

GET /api/polygons/:moduleId/batch?from=N&to=M   (max range: 50)
  → { moduleId, from, to, slices: { [index]: Polygon[] } }

GET /api/search?q=term&module=id
  → { query, results: Structure[] }

GET /static/slices/:path
  → WebP image (Cache-Control: 7d, immutable)
```

## 3. UI/UX — Event Mapping

### Mouse Events (Desktop)

| Event | Condition | Action | Conflict Resolution |
|-------|-----------|--------|---------------------|
| `wheel` | No modifier | `prevSlice()` / `nextSlice()` | `e.preventDefault()` |
| `wheel` | `Ctrl` or `Meta` held | `zoomAt(factor, cursorX, cursorY)` | Modifier key discriminator |
| `mousedown` (button 0) | Always | Start pan: record start position | — |
| `mousemove` | Pan active | Update `panX/panY` from delta | Skip hover detection while panning |
| `mousemove` | No pan | Hit-test (throttled 16ms) | — |
| `mouseup` | Move < 5px | Treat as click → select polygon | Distance threshold |
| `mouseup` | Move ≥ 5px | End pan | — |

### Touch Events (Mobile)

| Gesture | Fingers | Action |
|---------|---------|--------|
| Drag | 1 finger | Pan |
| Pinch | 2 fingers | Zoom at midpoint |
| Tap | 1 finger | Select polygon |

## 4. Zoom Math — Transform Matrices

The canvas uses a single affine transform:

```
ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * panX, dpr * panY)
```

**Screen ↔ Image coordinate conversion:**
```
screen_point = image_point × zoom + pan
image_point  = (screen_point - pan) / zoom
```

**Zoom-at-cursor (pivot point) derivation:**
```
Given: cursor at screen position (sx, sy)
       image point under cursor: img = (sx - panX) / zoom
After:  zoom' = zoom × factor
Need:   pan' such that (sx - pan') / zoom' = img
Solve:  pan' = sx - zoom' × img = sx - factor × (sx - panX)
```

This ensures the point under the cursor stays fixed during zoom — critical for medical image navigation.

## 6. QA Strategy

### Memory Leak Detection

1. **Chrome DevTools → Memory → Heap Snapshots**: Take snapshots before/after scrolling through all 80 slices. Compare retained sizes. Look for growing `HTMLImageElement` or `Detached DOM` counts.
2. **Performance Monitor**: Track JS Heap Size over a 10-minute continuous scrolling session. Should plateau at ~150MB, not grow linearly.
3. **`performance.measureUserAgentSpecificMemory()`**: Programmatic memory measurement in automated tests.
4. **Canvas-specific**: Verify `img.src = ''` properly releases decoded bitmaps by monitoring GPU memory in `chrome://gpu`.

### Acceptance Criteria — Polygon Accuracy at Extreme Zoom

**AC-1**: At 10x zoom, the visual boundary of every polygon must align within ±1 CSS pixel of its mathematical boundary. Verified by: rendering a test polygon with known vertices, screenshotting at 10x, and measuring pixel offsets.

**AC-2**: At 10x zoom, the point-in-polygon hit test must return the correct polygon ID for all cursor positions within 1px of the polygon edge. Verified by: automated test that moves a synthetic cursor along the polygon perimeter and checks `hitTest()` results.

**AC-3**: At 10x zoom, simultaneously panning and hovering must not produce "polygon drift" — the highlighted polygon must track the cursor perfectly with zero visual lag. Verified by: 60fps screen recording + frame-by-frame analysis confirming cursor position matches highlight boundary.
