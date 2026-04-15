-- Users and access
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'guest'
                CHECK (role IN ('super_admin','moderator','editor','subscriber','guest')),
  name          VARCHAR(255),
  institution   VARCHAR(255),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT now(),
  updated_at    TIMESTAMP DEFAULT now()
);

CREATE TABLE subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  plan             VARCHAR(20)
                   CHECK (plan IN ('monthly','yearly','institutional')),
  status           VARCHAR(20)
                   CHECK (status IN ('active','cancelled','expired')),
  started_at       TIMESTAMP,
  expires_at       TIMESTAMP,
  payment_provider VARCHAR(20)
                   CHECK (payment_provider IN ('stripe','yookassa','paypal')),
  external_id      VARCHAR(255)
);

CREATE TABLE ip_access_ranges (
  id               SERIAL PRIMARY KEY,
  cidr             CIDR NOT NULL,
  institution_name VARCHAR(255),
  expires_at       TIMESTAMP
);

-- Content structure
CREATE TABLE regions (
  id                SERIAL PRIMARY KEY,
  slug              VARCHAR(100) UNIQUE NOT NULL,
  name_translations JSONB,
  sort_order        INT DEFAULT 0
);

CREATE TABLE modalities (
  id                SERIAL PRIMARY KEY,
  code              VARCHAR(50) UNIQUE,
  name_translations JSONB
);

CREATE TABLE modules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    VARCHAR(255) UNIQUE NOT NULL,
  region_id               INT REFERENCES regions(id),
  modality_id             INT REFERENCES modalities(id),
  access_level            VARCHAR(10) DEFAULT 'premium'
                          CHECK (access_level IN ('free','premium')),
  status                  VARCHAR(20) DEFAULT 'draft'
                          CHECK (status IN ('draft','review','published','archived')),
  created_by              UUID REFERENCES users(id),
  published_at            TIMESTAMP,
  meta_title_translations JSONB,
  meta_desc_translations  JSONB,
  created_at              TIMESTAMP DEFAULT now(),
  updated_at              TIMESTAMP DEFAULT now()
);

CREATE TABLE projections (
  id          SERIAL PRIMARY KEY,
  module_id   UUID REFERENCES modules(id) ON DELETE CASCADE,
  type        VARCHAR(20)
              CHECK (type IN ('axial','sagittal','coronal','frontal','3d')),
  sort_order  INT DEFAULT 0
);

CREATE TABLE imaging_modes (
  id        SERIAL PRIMARY KEY,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  name      VARCHAR(50)
);

CREATE TABLE slices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_id INT REFERENCES projections(id) ON DELETE CASCADE,
  slice_number  INT NOT NULL,
  width_px      INT,
  height_px     INT
);

CREATE TABLE slice_images (
  id            SERIAL PRIMARY KEY,
  slice_id      UUID REFERENCES slices(id) ON DELETE CASCADE,
  mode_id       INT REFERENCES imaging_modes(id),
  image_url     VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500)
);

-- Annotations and terms
CREATE TABLE term_categories (
  id                SERIAL PRIMARY KEY,
  name_translations JSONB,
  color_hex         VARCHAR(7),
  icon_url          VARCHAR(500)
);

CREATE TABLE anatomical_terms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fma_id       VARCHAR(50),
  translations JSONB NOT NULL,
  category_id  INT REFERENCES term_categories(id),
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMP DEFAULT now()
);

CREATE TABLE annotations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slice_id   UUID REFERENCES slices(id) ON DELETE CASCADE,
  term_id    UUID REFERENCES anatomical_terms(id),
  x          FLOAT NOT NULL,
  y          FLOAT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX idx_slices_projection_id ON slices(projection_id);
CREATE INDEX idx_annotations_slice_id ON annotations(slice_id);
CREATE INDEX idx_modules_region_status ON modules(region_id, status);
CREATE INDEX idx_modules_created_by ON modules(created_by);
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX idx_terms_category_id ON anatomical_terms(category_id);
CREATE INDEX idx_slice_images_slice_id ON slice_images(slice_id);
CREATE INDEX idx_projections_module_id ON projections(module_id);
CREATE INDEX idx_imaging_modes_module_id ON imaging_modes(module_id);
