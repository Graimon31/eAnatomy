/** Core domain types for the anatomy atlas viewer */

export interface Module {
  id: number;
  slug: string;
  title: string;
  modality: string;
  plane: string;
  sliceCount: number;
}

export interface SliceInfo {
  sliceIndex: number;
  imagePath: string;
  width: number;
  height: number;
}

export interface Structure {
  id: number;
  nameEn: string;
  nameLat: string | null;
  color: string;
}

export interface Polygon {
  structureId: number;
  points: number[][]; // [[x, y], [x, y], ...]
}

/** Full polygon dataset for a module, keyed by slice index */
export interface PolygonData {
  structures: Structure[];
  slices: Record<string, Polygon[]>;
}
