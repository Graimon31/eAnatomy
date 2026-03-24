CREATE TABLE IF NOT EXISTS modules (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(128) UNIQUE NOT NULL,
    title       VARCHAR(256) NOT NULL,
    modality    VARCHAR(32) NOT NULL,
    plane       VARCHAR(32) NOT NULL,
    slice_count INT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slices (
    id          SERIAL PRIMARY KEY,
    module_id   INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    slice_index INT NOT NULL,
    image_path  TEXT NOT NULL,
    width       INT NOT NULL,
    height      INT NOT NULL,
    UNIQUE (module_id, slice_index)
);

CREATE TABLE IF NOT EXISTS structures (
    id          SERIAL PRIMARY KEY,
    module_id   INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    name_en     VARCHAR(512) NOT NULL,
    name_lat    VARCHAR(512),
    color       VARCHAR(9) DEFAULT '#00ff00'
);

CREATE TABLE IF NOT EXISTS polygons (
    id            SERIAL PRIMARY KEY,
    structure_id  INT NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
    slice_index   INT NOT NULL,
    points        JSONB NOT NULL,
    UNIQUE (structure_id, slice_index)
);

CREATE INDEX IF NOT EXISTS idx_polygons_struct_slice ON polygons(structure_id, slice_index);
CREATE INDEX IF NOT EXISTS idx_slices_module ON slices(module_id, slice_index);
CREATE INDEX IF NOT EXISTS idx_structures_module ON structures(module_id);
