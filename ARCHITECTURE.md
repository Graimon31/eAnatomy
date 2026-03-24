# eAnatomy Interactive Atlas — Architecture

## 1. System Analysis

### Scroll/Slice Mechanics
- **Z-index ↔ Slice**: Mouse wheel (no modifier) maps to `sliceIndex ± 1`. Each index corresponds to a single axial/sagittal/coronal cut stored as a WebP image (~50-150 KB each).
- **Image caching**: An LRU cache holds up to **MAX_CACHED = 30** decoded `HTMLImageElement` objects in memory (~150 MB ceiling). On each slice change, a preloader fetches `[current-5 … current+5]` and evicts images outside this window from the oldest end.
- **Polygon sync**: Polygons are stored in **image-space** coordinates (px relative to the original image dimensions). The same `ctx.translate / ctx.scale` affine transform applied to the image is applied to polygon drawing, guaranteeing pixel-perfect alignment at any zoom/pan.

### Performance Targets
| Metric | Target |
|---|---|
| Canvas repaint | ≥ 55 FPS (< 18 ms per frame) |
| Client RAM ceiling | ≤ 250 MB (images + polygon JSON) |
| Hover hit-test latency | < 2 ms (ray-casting in image-space) |
| Slice switch (cached) | < 16 ms |
| Slice switch (network) | < 300 ms on 4G |
| Polygon JSON (gzipped) | < 200 KB per module |

## 2. Database Schema (PostgreSQL)

```sql
-- Modules (e.g. "Brain MRI Axial", "Knee MRI Sagittal")
CREATE TABLE modules (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(128) UNIQUE NOT NULL,
    title       VARCHAR(256) NOT NULL,
    modality    VARCHAR(32) NOT NULL,   -- MRI, CT, etc.
    plane       VARCHAR(32) NOT NULL,   -- axial, sagittal, coronal
    slice_count INT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Slices — one row per image
CREATE TABLE slices (
    id          SERIAL PRIMARY KEY,
    module_id   INT NOT NULL REFERENCES modules(id),
    slice_index INT NOT NULL,           -- 0-based Z position
    image_path  TEXT NOT NULL,           -- e.g. /images/brain-mri-axial/042.webp
    width       INT NOT NULL,
    height      INT NOT NULL,
    UNIQUE (module_id, slice_index)
);

-- Anatomical structures (labels)
CREATE TABLE structures (
    id          SERIAL PRIMARY KEY,
    module_id   INT NOT NULL REFERENCES modules(id),
    name_en     VARCHAR(512) NOT NULL,
    name_lat    VARCHAR(512),
    color       VARCHAR(9) DEFAULT '#00ff00'  -- hex RGBA for overlay
);

-- Polygons — geometry per structure per slice
CREATE TABLE polygons (
    id            SERIAL PRIMARY KEY,
    structure_id  INT NOT NULL REFERENCES structures(id),
    slice_index   INT NOT NULL,
    -- stored as JSON array of [x,y] pairs in image-space pixels
    points        JSONB NOT NULL,
    UNIQUE (structure_id, slice_index)  -- one polygon per structure per slice
);

CREATE INDEX idx_polygons_slice ON polygons(structure_id, slice_index);
CREATE INDEX idx_slices_module  ON slices(module_id, slice_index);
```

## 3. REST API Contracts

### GET /api/modules
```json
[{ "id": 1, "slug": "brain-mri-axial", "title": "Brain MRI — Axial", "modality": "MRI", "plane": "axial", "sliceCount": 96 }]
```

### GET /api/modules/:slug
Full module metadata + ordered slice list.

### GET /api/modules/:slug/slices
```json
[{ "sliceIndex": 0, "imagePath": "/images/brain-mri-axial/000.webp", "width": 512, "height": 512 }, ...]
```

### GET /api/modules/:slug/polygons
**Compressed** (gzip/brotli). Returns ALL polygons for the module grouped by slice:
```json
{
  "structures": [
    { "id": 1, "nameEn": "Frontal Lobe", "nameLat": "Lobus frontalis", "color": "#e74c3c" }
  ],
  "slices": {
    "0": [{ "structureId": 1, "points": [[120,80],[130,82],...] }],
    "1": [...]
  }
}
```

### GET /api/modules/:slug/polygons/:sliceIndex
Single-slice polygon data (for lazy loading fallback).

## 4. UI/UX — Input Event Mapping

| Input | Action | Guard |
|---|---|---|
| Wheel (no modifier) | Change slice ±1 | `e.deltaY` sign; debounce 30 ms |
| Ctrl + Wheel | Zoom in/out (×0.9 / ×1.1) centered on cursor | `e.ctrlKey`; clamp [0.5, 10] |
| Pinch (touch) | Zoom | Two-finger gesture via pointer events |
| LMB drag (no modifier) | Pan | `pointerdown → pointermove → pointerup` |
| Hover (no button) | Hit-test polygons, show tooltip | `pointermove`; throttle to rAF |
| Click on polygon | Select structure, show detail panel | `pointerup` after < 5px movement |

All pointer coordinates are inverse-transformed to image-space before hit-testing:
```
imageX = (screenX - panX) / zoom
imageY = (screenY - panY) / zoom
```
