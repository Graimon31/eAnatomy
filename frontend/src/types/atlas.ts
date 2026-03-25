/** Core domain types for the anatomy atlas */

export interface AtlasModule {
  id: string;
  slug: string;
  title: string;
  modality: string;
  body_region: string;
  plane: string;
  total_slices: number;
  image_width: number;
  image_height: number;
}

export interface Vertex {
  x: number;
  y: number;
}

export interface Polygon {
  id: string;
  structureCode: string;
  labelEn: string;
  labelLa: string | null;
  color: string;
  vertices: Vertex[];
}

export interface SlicePolygonsResponse {
  moduleId: string;
  sliceIndex: number;
  count: number;
  polygons: Polygon[];
}

export interface SliceInfo {
  slice_index: number;
  image_path: string;
}
