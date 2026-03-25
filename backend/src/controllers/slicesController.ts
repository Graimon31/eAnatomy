import { Request, Response } from 'express';
import { pool } from '../models/db';

export async function getSlices(req: Request, res: Response) {
  const { moduleId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT slice_index, image_path
       FROM slices
       WHERE module_id = $1
       ORDER BY slice_index`,
      [moduleId]
    );
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json({ moduleId, slices: rows });
  } catch (err) {
    console.error('[slices] error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
