import { Request, Response } from "express";
import { pool } from "../db/pool";

/**
 * GET /api/modules/:slug/polygons
 *
 * Returns ALL polygon data for a module in a single compressed response.
 * The response is structured for efficient client-side lookup by slice index.
 *
 * Compression is handled by the express `compression` middleware (gzip/brotli),
 * which typically reduces ~800 KB of polygon JSON down to ~80-150 KB.
 */
export async function getModulePolygons(req: Request, res: Response) {
  const { slug } = req.params;

  // 1. Resolve module
  const modResult = await pool.query(
    `SELECT id FROM modules WHERE slug = $1`,
    [slug]
  );
  if (modResult.rows.length === 0) {
    return res.status(404).json({ error: "Module not found" });
  }
  const moduleId: number = modResult.rows[0].id;

  // 2. Fetch structures
  const structResult = await pool.query(
    `SELECT id, name_en AS "nameEn", name_lat AS "nameLat", color
     FROM structures WHERE module_id = $1 ORDER BY id`,
    [moduleId]
  );

  // 3. Fetch all polygons for this module in one query (the critical query)
  const polyResult = await pool.query(
    `SELECT p.structure_id AS "structureId",
            p.slice_index  AS "sliceIndex",
            p.points
     FROM polygons p
     JOIN structures st ON st.id = p.structure_id
     WHERE st.module_id = $1
     ORDER BY p.slice_index, p.structure_id`,
    [moduleId]
  );

  // 4. Group polygons by slice index for O(1) client-side access
  const slices: Record<string, Array<{ structureId: number; points: number[][] }>> = {};
  for (const row of polyResult.rows) {
    const key = String(row.sliceIndex);
    if (!slices[key]) slices[key] = [];
    slices[key].push({
      structureId: row.structureId,
      points: row.points, // already parsed from JSONB
    });
  }

  // 5. Set aggressive cache headers — polygon data is immutable per version
  res.set("Cache-Control", "public, max-age=86400, immutable");
  res.json({ structures: structResult.rows, slices });
}

/**
 * GET /api/modules/:slug/polygons/:sliceIndex
 *
 * Single-slice fallback for lazy loading / bandwidth-constrained clients.
 */
export async function getSlicePolygons(req: Request, res: Response) {
  const { slug, sliceIndex } = req.params;
  const idx = parseInt(sliceIndex, 10);
  if (isNaN(idx)) return res.status(400).json({ error: "Invalid slice index" });

  const modResult = await pool.query(
    `SELECT id FROM modules WHERE slug = $1`,
    [slug]
  );
  if (modResult.rows.length === 0) {
    return res.status(404).json({ error: "Module not found" });
  }
  const moduleId: number = modResult.rows[0].id;

  const result = await pool.query(
    `SELECT p.structure_id AS "structureId",
            st.name_en     AS "nameEn",
            st.name_lat    AS "nameLat",
            st.color,
            p.points
     FROM polygons p
     JOIN structures st ON st.id = p.structure_id
     WHERE st.module_id = $1 AND p.slice_index = $2
     ORDER BY p.structure_id`,
    [moduleId, idx]
  );

  res.set("Cache-Control", "public, max-age=86400, immutable");
  res.json(result.rows);
}
