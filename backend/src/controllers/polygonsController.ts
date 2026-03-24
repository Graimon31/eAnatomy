import { Request, Response } from 'express';
import { pool } from '../models/db';

// --------------------------------------------------------------------------
// Types matching the DB view v_slice_polygons
// --------------------------------------------------------------------------
interface PolygonRow {
  polygon_id: string;
  structure_code: string;
  label_en: string;
  label_la: string | null;
  color: string;
  vertices: Array<{ x: number; y: number }>;
}

interface SlicePolygonsResponse {
  moduleId: string;
  sliceIndex: number;
  count: number;
  polygons: Array<{
    id: string;
    structureCode: string;
    labelEn: string;
    labelLa: string | null;
    color: string;
    vertices: Array<{ x: number; y: number }>;
  }>;
}

// --------------------------------------------------------------------------
// GET /api/polygons/:moduleId/:sliceIndex
//
// This is THE hot endpoint. Returns all polygons for a given module + slice.
// Response is typically 200KB–5MB of JSON, so compression middleware is vital.
//
// Optional query params:
//   ?fields=vertices          — only return vertex arrays (lighter payload)
//   ?structure=hippocampus    — filter by structure code
// --------------------------------------------------------------------------
export async function getSlicePolygons(req: Request, res: Response) {
  const { moduleId, sliceIndex } = req.params;
  const sliceIdx = parseInt(sliceIndex, 10);

  if (isNaN(sliceIdx) || sliceIdx < 0) {
    return res.status(400).json({ error: 'Invalid sliceIndex' });
  }

  const structureFilter = req.query.structure as string | undefined;

  try {
    let query = `
      SELECT polygon_id, structure_code, label_en, label_la, color, vertices
      FROM v_slice_polygons
      WHERE module_id = $1 AND slice_index = $2
    `;
    const params: (string | number)[] = [moduleId, sliceIdx];

    if (structureFilter) {
      query += ` AND structure_code = $3`;
      params.push(structureFilter);
    }

    query += ` ORDER BY structure_code`;

    const { rows } = await pool.query<PolygonRow>(query, params);

    const response: SlicePolygonsResponse = {
      moduleId,
      sliceIndex: sliceIdx,
      count: rows.length,
      polygons: rows.map((r) => ({
        id: r.polygon_id,
        structureCode: r.structure_code,
        labelEn: r.label_en,
        labelLa: r.label_la,
        color: r.color,
        vertices: r.vertices,
      })),
    };

    // Aggressive caching — polygon data rarely changes in production
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    res.setHeader('ETag', `W/"${moduleId}-${sliceIdx}-${rows.length}"`);

    return res.json(response);
  } catch (err) {
    console.error('[polygons] query error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// --------------------------------------------------------------------------
// GET /api/polygons/:moduleId/batch?from=10&to=20
//
// Batch endpoint — prefetch polygons for a range of slices in one request.
// Used by the frontend preloader to avoid waterfall of individual requests.
// --------------------------------------------------------------------------
export async function getBatchPolygons(req: Request, res: Response) {
  const { moduleId } = req.params;
  const from = parseInt(req.query.from as string, 10) || 0;
  const to = parseInt(req.query.to as string, 10) || from + 10;

  if (to - from > 50) {
    return res.status(400).json({ error: 'Max batch range is 50 slices' });
  }

  try {
    const { rows } = await pool.query<PolygonRow & { slice_index: number }>(
      `SELECT polygon_id, slice_index, structure_code, label_en, label_la, color, vertices
       FROM v_slice_polygons
       WHERE module_id = $1 AND slice_index >= $2 AND slice_index <= $3
       ORDER BY slice_index, structure_code`,
      [moduleId, from, to]
    );

    // Group by slice
    const bySlice: Record<number, SlicePolygonsResponse['polygons']> = {};
    for (const r of rows) {
      const idx = r.slice_index;
      if (!bySlice[idx]) bySlice[idx] = [];
      bySlice[idx].push({
        id: r.polygon_id,
        structureCode: r.structure_code,
        labelEn: r.label_en,
        labelLa: r.label_la,
        color: r.color,
        vertices: r.vertices,
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.json({ moduleId, from, to, slices: bySlice });
  } catch (err) {
    console.error('[polygons/batch] query error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
