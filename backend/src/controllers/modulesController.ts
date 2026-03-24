import { Request, Response } from 'express';
import { pool } from '../models/db';

export async function listModules(_req: Request, res: Response) {
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, title, modality, body_region, plane, total_slices,
              image_width, image_height
       FROM atlas_modules ORDER BY body_region, title`
    );
    res.json(rows);
  } catch (err) {
    console.error('[modules] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getModule(req: Request, res: Response) {
  const { slugOrId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, title, modality, body_region, plane, total_slices,
              image_width, image_height
       FROM atlas_modules
       WHERE slug = $1 OR id::text = $1
       LIMIT 1`,
      [slugOrId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Module not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[modules] get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
