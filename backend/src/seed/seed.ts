/**
 * Seed script — generates realistic demo data for the atlas.
 * Creates a "Brain MRI — Axial" module with 80 slices and ~30 structures
 * with procedurally generated polygon geometry.
 *
 * Usage: npx ts-node src/seed/seed.ts
 */
import { pool } from '../models/db';

const BRAIN_STRUCTURES = [
  { code: 'frontal_lobe', label_en: 'Frontal Lobe', label_la: 'Lobus frontalis', color: '#FF6B6B' },
  { code: 'parietal_lobe', label_en: 'Parietal Lobe', label_la: 'Lobus parietalis', color: '#4ECDC4' },
  { code: 'temporal_lobe', label_en: 'Temporal Lobe', label_la: 'Lobus temporalis', color: '#45B7D1' },
  { code: 'occipital_lobe', label_en: 'Occipital Lobe', label_la: 'Lobus occipitalis', color: '#96CEB4' },
  { code: 'cerebellum', label_en: 'Cerebellum', label_la: 'Cerebellum', color: '#FFEAA7' },
  { code: 'hippocampus', label_en: 'Hippocampus', label_la: 'Hippocampus', color: '#DDA0DD' },
  { code: 'thalamus', label_en: 'Thalamus', label_la: 'Thalamus', color: '#98D8C8' },
  { code: 'hypothalamus', label_en: 'Hypothalamus', label_la: 'Hypothalamus', color: '#F7DC6F' },
  { code: 'caudate_nucleus', label_en: 'Caudate Nucleus', label_la: 'Nucleus caudatus', color: '#BB8FCE' },
  { code: 'putamen', label_en: 'Putamen', label_la: 'Putamen', color: '#85C1E9' },
  { code: 'globus_pallidus', label_en: 'Globus Pallidus', label_la: 'Globus pallidus', color: '#82E0AA' },
  { code: 'corpus_callosum', label_en: 'Corpus Callosum', label_la: 'Corpus callosum', color: '#F8C471' },
  { code: 'lateral_ventricle', label_en: 'Lateral Ventricle', label_la: 'Ventriculus lateralis', color: '#5DADE2' },
  { code: 'third_ventricle', label_en: 'Third Ventricle', label_la: 'Ventriculus tertius', color: '#48C9B0' },
  { code: 'internal_capsule', label_en: 'Internal Capsule', label_la: 'Capsula interna', color: '#EB984E' },
  { code: 'insula', label_en: 'Insula', label_la: 'Insula', color: '#AF7AC5' },
  { code: 'cingulate_gyrus', label_en: 'Cingulate Gyrus', label_la: 'Gyrus cinguli', color: '#5499C7' },
  { code: 'substantia_nigra', label_en: 'Substantia Nigra', label_la: 'Substantia nigra', color: '#52BE80' },
  { code: 'red_nucleus', label_en: 'Red Nucleus', label_la: 'Nucleus ruber', color: '#CD6155' },
  { code: 'superior_colliculus', label_en: 'Superior Colliculus', label_la: 'Colliculus superior', color: '#AAB7B8' },
  { code: 'amygdala', label_en: 'Amygdala', label_la: 'Corpus amygdaloideum', color: '#F1948A' },
  { code: 'optic_chiasm', label_en: 'Optic Chiasm', label_la: 'Chiasma opticum', color: '#AED6F1' },
  { code: 'pons', label_en: 'Pons', label_la: 'Pons', color: '#A3E4D7' },
  { code: 'medulla_oblongata', label_en: 'Medulla Oblongata', label_la: 'Medulla oblongata', color: '#FAD7A0' },
  { code: 'pineal_gland', label_en: 'Pineal Gland', label_la: 'Glandula pinealis', color: '#D2B4DE' },
  { code: 'choroid_plexus', label_en: 'Choroid Plexus', label_la: 'Plexus choroideus', color: '#A9CCE3' },
  { code: 'falx_cerebri', label_en: 'Falx Cerebri', label_la: 'Falx cerebri', color: '#A9DFBF' },
  { code: 'tentorium', label_en: 'Tentorium Cerebelli', label_la: 'Tentorium cerebelli', color: '#F9E79F' },
];

// Generate an irregular polygon around a center point
function generatePolygon(
  cx: number, cy: number, radius: number, points: number = 12
): Array<{ x: number; y: number }> {
  const vertices: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < points; i++) {
    const angle = (2 * Math.PI * i) / points;
    const r = radius * (0.7 + Math.random() * 0.6); // irregularity
    vertices.push({
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
    });
  }
  return vertices;
}

// Determines which slices a structure appears on (Gaussian distribution around a center)
function sliceRange(center: number, spread: number, total: number): number[] {
  const slices: number[] = [];
  const lo = Math.max(0, Math.round(center - spread));
  const hi = Math.min(total - 1, Math.round(center + spread));
  for (let i = lo; i <= hi; i++) slices.push(i);
  return slices;
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create module
    const IMG_W = 512;
    const IMG_H = 512;
    const TOTAL_SLICES = 80;

    const { rows: [mod] } = await client.query(
      `INSERT INTO atlas_modules (slug, title, modality, body_region, plane, total_slices, image_width, image_height)
       VALUES ('brain-axial-mri', 'Brain MRI — Axial', 'MRI', 'brain', 'axial', $1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET total_slices = $1
       RETURNING id`,
      [TOTAL_SLICES, IMG_W, IMG_H]
    );
    const moduleId = mod.id;

    // 2. Create slices
    for (let i = 0; i < TOTAL_SLICES; i++) {
      await client.query(
        `INSERT INTO slices (module_id, slice_index, image_path)
         VALUES ($1, $2, $3)
         ON CONFLICT (module_id, slice_index) DO NOTHING`,
        [moduleId, i, `brain-axial/${String(i).padStart(3, '0')}.webp`]
      );
    }

    // 3. Create structures + polygons
    for (const struct of BRAIN_STRUCTURES) {
      const { rows: [s] } = await client.query(
        `INSERT INTO structures (module_id, code, label_en, label_la, color)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [moduleId, struct.code, struct.label_en, struct.label_la, struct.color]
      );
      if (!s) continue;

      // Each structure appears on a random range of slices
      const center = 10 + Math.floor(Math.random() * 60);
      const spread = 5 + Math.floor(Math.random() * 15);
      const slices = sliceRange(center, spread, TOTAL_SLICES);

      for (const si of slices) {
        const cx = 100 + Math.random() * (IMG_W - 200);
        const cy = 100 + Math.random() * (IMG_H - 200);
        const radius = 20 + Math.random() * 60;
        const verts = generatePolygon(cx, cy, radius, 8 + Math.floor(Math.random() * 12));
        const area = Math.PI * radius * radius; // approximate

        await client.query(
          `INSERT INTO polygons (structure_id, slice_index, vertices, area_px)
           VALUES ($1, $2, $3, $4)`,
          [s.id, si, JSON.stringify(verts), area]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Seeded module "${mod.id}" with ${TOTAL_SLICES} slices and ${BRAIN_STRUCTURES.length} structures.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
