export type Translations = Record<string, string>;

export interface User {
  id: string; email: string; role: string; name: string;
  institution: string; is_active: boolean; created_at: string;
}

export interface Module {
  id: string; slug: string; region_id: number | null; modality_id: number | null;
  access_level: 'free' | 'premium'; status: 'draft' | 'review' | 'published' | 'archived';
  created_by: string | null; meta_title_translations: Translations; meta_desc_translations: Translations;
  created_at: string; region?: Region; modality?: Modality; projections?: Projection[]; modes?: ImagingMode[];
}

export interface Region { id: number; slug: string; name_translations: Translations; }
export interface Modality { id: number; code: string; name_translations: Translations; }
export interface Projection { id: number; module_id: string; type: string; sort_order: number; }
export interface ImagingMode { id: number; module_id: string; name: string; }
export interface Slice { id: string; projection_id: number; slice_number: number; width_px: number; height_px: number; images?: SliceImage[]; }
export interface SliceImage { id: number; slice_id: string; mode_id: number; image_url: string; thumbnail_url: string; }
export interface Annotation { id: string; slice_id: string; term_id: string; x: number; y: number; term?: AnatomicalTerm; }
export interface AnatomicalTerm { id: string; fma_id: string; translations: Translations; category_id: number | null; category?: TermCategory; }
export interface TermCategory { id: number; name_translations: Translations; color_hex: string; }
export interface Subscription { id: string; user_id: string; plan: string; status: string; expires_at: string; }
export interface IPAccessRange { id: number; cidr: string; institution_name: string; expires_at: string | null; }
export interface PaginatedResponse<T> { items: T[]; total: number; page: number; limit: number; }
export interface TaskProgress { status: string; progress: string; done: number; total: number; error?: string; }
