/**
 * Seed script — generates a demo module with synthetic slices and polygons
 * for local development. Run: npm run db:seed
 */
import fs from "fs";
import path from "path";
import { pool } from "./pool";

const SCHEMA_PATH = path.join(__dirname, "schema.sql");

async function seed() {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  await pool.query(schema);

  // Upsert demo module
  const {
    rows: [mod],
  } = await pool.query(
    `INSERT INTO modules (slug, title, modality, plane, slice_count)
     VALUES ('brain-mri-axial', 'Brain MRI — Axial', 'MRI', 'axial', 48)
     ON CONFLICT (slug) DO UPDATE SET slice_count = 48
     RETURNING id`
  );
  const moduleId: number = mod.id;

  // Generate 48 slices
  for (let i = 0; i < 48; i++) {
    const padded = String(i).padStart(3, "0");
    await pool.query(
      `INSERT INTO slices (module_id, slice_index, image_path, width, height)
       VALUES ($1, $2, $3, 512, 512)
       ON CONFLICT (module_id, slice_index) DO NOTHING`,
      [moduleId, i, `/images/brain-mri-axial/${padded}.webp`]
    );
  }

  // Generate demo structures with synthetic polygons
  const structures = [
    { nameEn: "Frontal Lobe", nameLat: "Lobus frontalis", color: "#e74c3caa" },
    { nameEn: "Parietal Lobe", nameLat: "Lobus parietalis", color: "#3498dbaa" },
    { nameEn: "Temporal Lobe", nameLat: "Lobus temporalis", color: "#2ecc71aa" },
    { nameEn: "Occipital Lobe", nameLat: "Lobus occipitalis", color: "#f39c12aa" },
    { nameEn: "Cerebellum", nameLat: "Cerebellum", color: "#9b59b6aa" },
    { nameEn: "Lateral Ventricle", nameLat: "Ventriculus lateralis", color: "#1abc9caa" },
    { nameEn: "Thalamus", nameLat: "Thalamus", color: "#e67e22aa" },
    { nameEn: "Caudate Nucleus", nameLat: "Nucleus caudatus", color: "#e91e63aa" },
  ];

  for (const s of structures) {
    const {
      rows: [row],
    } = await pool.query(
      `INSERT INTO structures (module_id, name_en, name_lat, color)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [moduleId, s.nameEn, s.nameLat, s.color]
    );
    if (!row) continue;
    const structId: number = row.id;

    // Generate polygons for slices where this structure is visible
    const startSlice = Math.floor(Math.random() * 10);
    const endSlice = startSlice + 15 + Math.floor(Math.random() * 20);
    for (let si = startSlice; si < Math.min(endSlice, 48); si++) {
      const cx = 200 + Math.random() * 112;
      const cy = 200 + Math.random() * 112;
      const r = 30 + Math.random() * 40;
      const nPts = 12 + Math.floor(Math.random() * 8);
      const points: number[][] = [];
      for (let p = 0; p < nPts; p++) {
        const angle = (2 * Math.PI * p) / nPts;
        const jitter = 0.85 + Math.random() * 0.3;
        points.push([
          Math.round(cx + r * jitter * Math.cos(angle)),
          Math.round(cy + r * jitter * Math.sin(angle)),
        ]);
      }
      await pool.query(
        `INSERT INTO polygons (structure_id, slice_index, points)
         VALUES ($1, $2, $3)
         ON CONFLICT (structure_id, slice_index) DO NOTHING`,
        [structId, si, JSON.stringify(points)]
      );
    }
  }

  console.log("Seed complete: 48 slices, 8 structures with polygons.");
  await pool.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
