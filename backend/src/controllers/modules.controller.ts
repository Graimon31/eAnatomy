import { Request, Response } from "express";
import { pool } from "../db/pool";

/** GET /api/modules */
export async function listModules(_req: Request, res: Response) {
  const { rows } = await pool.query(
    `SELECT id, slug, title, modality, plane, slice_count AS "sliceCount"
     FROM modules ORDER BY title`
  );
  res.json(rows);
}

/** GET /api/modules/:slug */
export async function getModule(req: Request, res: Response) {
  const { rows } = await pool.query(
    `SELECT id, slug, title, modality, plane, slice_count AS "sliceCount"
     FROM modules WHERE slug = $1`,
    [req.params.slug]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Module not found" });
  res.json(rows[0]);
}

/** GET /api/modules/:slug/slices */
export async function getSlices(req: Request, res: Response) {
  const { rows } = await pool.query(
    `SELECT s.slice_index AS "sliceIndex",
            s.image_path  AS "imagePath",
            s.width, s.height
     FROM slices s
     JOIN modules m ON m.id = s.module_id
     WHERE m.slug = $1
     ORDER BY s.slice_index`,
    [req.params.slug]
  );
  res.json(rows);
}
