-- ============================================================
-- eAnatomy Atlas — PostgreSQL Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fast label search

-- ============================================================
-- 1. Atlas modules (e.g. "Brain MRI — Axial", "Knee MRI — Sagittal")
-- ============================================================
CREATE TABLE atlas_modules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            VARCHAR(120) UNIQUE NOT NULL,       -- URL-friendly key
    title           VARCHAR(255) NOT NULL,
    modality        VARCHAR(40)  NOT NULL DEFAULT 'MRI', -- MRI | CT | Illustration
    body_region     VARCHAR(80)  NOT NULL,               -- brain, knee, thorax…
    plane           VARCHAR(20)  NOT NULL DEFAULT 'axial', -- axial | sagittal | coronal
    total_slices    INT          NOT NULL CHECK (total_slices > 0),
    image_width     INT          NOT NULL,               -- native pixel width of slices
    image_height    INT          NOT NULL,               -- native pixel height of slices
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_modules_region ON atlas_modules (body_region);

-- ============================================================
-- 2. Slices — one image per Z-index inside a module
-- ============================================================
CREATE TABLE slices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id       UUID NOT NULL REFERENCES atlas_modules(id) ON DELETE CASCADE,
    slice_index     INT  NOT NULL,                        -- 0-based Z position
    image_path      TEXT NOT NULL,                        -- relative path to WebP, e.g. "brain-axial/042.webp"
    UNIQUE (module_id, slice_index)
);

CREATE INDEX idx_slices_module ON slices (module_id, slice_index);

-- ============================================================
-- 3. Anatomical structures (labels)
-- ============================================================
CREATE TABLE structures (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id       UUID         NOT NULL REFERENCES atlas_modules(id) ON DELETE CASCADE,
    code            VARCHAR(60)  NOT NULL,                -- short code, e.g. "hippocampus"
    label_en        VARCHAR(255) NOT NULL,
    label_la        VARCHAR(255),                         -- Latin name
    color           VARCHAR(9)   NOT NULL DEFAULT '#00FF00', -- hex RGBA for overlay
    description     TEXT
);

CREATE INDEX idx_structures_module ON structures (module_id);
CREATE INDEX idx_structures_label  ON structures USING gin (label_en gin_trgm_ops);

-- ============================================================
-- 4. Polygons — one structure can have many polygons across slices
--    Coordinates stored as JSONB array of {x,y} pairs in IMAGE-SPACE pixels.
--    Example: [{"x":120,"y":340},{"x":125,"y":345}, …]
-- ============================================================
CREATE TABLE polygons (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    structure_id    UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
    slice_index     INT  NOT NULL,                        -- which slice this polygon belongs to
    vertices        JSONB NOT NULL,                        -- [{x,y}, …] closed polygon
    area_px         FLOAT                                  -- pre-computed area in px² for sorting
);

CREATE INDEX idx_polygons_structure ON polygons (structure_id);
CREATE INDEX idx_polygons_slice     ON polygons (slice_index);
-- Composite index for the hot query: "give me all polygons for module X, slice Y"
CREATE INDEX idx_polygons_struct_slice ON polygons (structure_id, slice_index);

-- ============================================================
-- 5. Helper view — denormalized for the main API endpoint
-- ============================================================
CREATE VIEW v_slice_polygons AS
SELECT
    p.id            AS polygon_id,
    s.module_id,
    p.slice_index,
    s.code          AS structure_code,
    s.label_en,
    s.label_la,
    s.color,
    p.vertices
FROM polygons p
JOIN structures s ON s.id = p.structure_id;

-- ============================================================
-- Trigger: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_modules_updated
    BEFORE UPDATE ON atlas_modules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
