/** Internationalized name stored as JSON object keyed by lang code */
export type Translations = Record<string, string>;

export interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'moderator' | 'editor' | 'subscriber' | 'guest';
  name: string;
  institution: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Region {
  id: number;
  slug: string;
  name_translations: Translations;
  sort_order: number;
}

export interface Modality {
  id: number;
  code: string;
  name_translations: Translations;
}

export interface ImagingMode {
  id: number;
  module_id: string;
  name: string;
}

export type ProjectionType = 'axial' | 'sagittal' | 'frontal' | '3d';

export interface Projection {
  id: number;
  module_id: string;
  type: ProjectionType;
  sort_order: number;
  slices?: Slice[];
}

export interface Module {
  id: string;
  slug: string;
  region_id: number | null;
  modality_id: number | null;
  access_level: 'free' | 'premium';
  status: 'draft' | 'review' | 'published' | 'archived';
  created_by: string | null;
  published_at: string | null;
  meta_title_translations: Translations;
  meta_desc_translations: Translations;
  created_at: string;
  updated_at: string;
  region?: Region;
  modality?: Modality;
  projections?: Projection[];
  modes?: ImagingMode[];
}

export interface SliceImage {
  id: number;
  slice_id: string;
  mode_id: number;
  image_url: string;
  thumbnail_url: string;
}

export interface Slice {
  id: string;
  projection_id: number;
  slice_number: number;
  width_px: number;
  height_px: number;
  images?: SliceImage[];
}

export interface Annotation {
  id: string;
  x: number;
  y: number;
  term_name: string;
  category: string;
  color_hex: string;
}

export interface TermCategory {
  id: number;
  name_translations: Translations;
  color_hex: string;
  icon_url: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ModuleResponse {
  module: Module;
  locked: boolean;
  preview_slices?: number;
}

export interface SlicesResponse {
  items: Slice[];
  total: number;
  locked: boolean;
}

export interface SearchResponse {
  terms: Array<{
    id: string;
    ru: string;
    en: string;
    la: string;
    category_id: number;
    color_hex: string;
  }>;
}

export interface ModuleFilter {
  region?: number;
  modality?: number;
  access?: string;
  lang?: string;
  page?: number;
  limit?: number;
}
