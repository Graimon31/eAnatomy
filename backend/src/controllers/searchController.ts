import { Request, Response } from 'express';
import { pool } from '../models/db';

/** GET /api/search?q=hippocampus&module=<id> */
export async function searchStructures(req: Request, res: Response) {
  const q = (req.query.q as string || '').trim();
  if (q.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }
  const moduleId = req.query.module as string | undefined;

  try {
    let query = `
      SELECT s.id, s.code, s.label_en, s.label_la, s.color, s.module_id,
             array_agg(DISTINCT p.slice_index ORDER BY p.slice_index) AS slice_indices
      FROM structures s
      JOIN polygons p ON p.structure_id = s.id
      WHERE s.label_en ILIKE $1
    `;
    const params: string[] = [`%${q}%`];

    if (moduleId) {
      query += ` AND s.module_id = $2`;
      params.push(moduleId);
    }

    query += ` GROUP BY s.id ORDER BY s.label_en LIMIT 50`;

    const { rows } = await pool.query(query, params);
    res.json({ query: q, results: rows });
  } catch (err) {
    console.error('[search] error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
