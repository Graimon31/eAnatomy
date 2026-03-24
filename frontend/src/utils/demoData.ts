/**
 * Generates synthetic demo data for running the frontend without a backend.
 * Produces realistic polygon geometry for 8 brain structures across 48 slices.
 */
import type { Module, SliceInfo, PolygonData, Polygon, Structure } from "@/types/atlas";

export function generateDemoModule(): Module {
  return {
    id: 1,
    slug: "brain-mri-axial",
    title: "Brain MRI — Axial",
    modality: "MRI",
    plane: "axial",
    sliceCount: 48,
  };
}

export function generateDemoSlices(): SliceInfo[] {
  return Array.from({ length: 48 }, (_, i) => ({
    sliceIndex: i,
    imagePath: `/demo/slice-${i}.png`, // will use generated canvas images
    width: 512,
    height: 512,
  }));
}

const STRUCTURES: Omit<Structure, "id">[] = [
  { nameEn: "Frontal Lobe", nameLat: "Lobus frontalis", color: "#e74c3caa" },
  { nameEn: "Parietal Lobe", nameLat: "Lobus parietalis", color: "#3498dbaa" },
  { nameEn: "Temporal Lobe (L)", nameLat: "Lobus temporalis", color: "#2ecc71aa" },
  { nameEn: "Temporal Lobe (R)", nameLat: "Lobus temporalis", color: "#27ae60aa" },
  { nameEn: "Occipital Lobe", nameLat: "Lobus occipitalis", color: "#f39c12aa" },
  { nameEn: "Cerebellum", nameLat: "Cerebellum", color: "#9b59b6aa" },
  { nameEn: "Lateral Ventricle (L)", nameLat: "Ventriculus lateralis", color: "#1abc9caa" },
  { nameEn: "Lateral Ventricle (R)", nameLat: "Ventriculus lateralis", color: "#16a085aa" },
  { nameEn: "Thalamus", nameLat: "Thalamus", color: "#e67e22aa" },
  { nameEn: "Caudate Nucleus", nameLat: "Nucleus caudatus", color: "#e91e63aa" },
  { nameEn: "Corpus Callosum", nameLat: "Corpus callosum", color: "#00bcd4aa" },
  { nameEn: "Internal Capsule", nameLat: "Capsula interna", color: "#ff9800aa" },
];

/** Generate a smooth organic polygon around a center point */
function generateOrganicPolygon(
  cx: number, cy: number, rx: number, ry: number,
  numPoints: number, seed: number
): number[][] {
  const points: number[][] = [];
  // Simple seeded pseudo-random
  let s = seed;
  const rand = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };

  for (let i = 0; i < numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    const jitter = 0.82 + rand() * 0.36;
    points.push([
      Math.round(cx + rx * jitter * Math.cos(angle)),
      Math.round(cy + ry * jitter * Math.sin(angle)),
    ]);
  }
  return points;
}

// Structure configurations: center, radii, visible slice range
const STRUCT_CONFIGS = [
  { cx: 256, cy: 180, rx: 80, ry: 60, sliceStart: 10, sliceEnd: 40, nPts: 18 }, // Frontal
  { cx: 256, cy: 300, rx: 70, ry: 50, sliceStart: 8, sliceEnd: 38, nPts: 16 },  // Parietal
  { cx: 150, cy: 280, rx: 45, ry: 55, sliceStart: 15, sliceEnd: 35, nPts: 14 }, // Temporal L
  { cx: 362, cy: 280, rx: 45, ry: 55, sliceStart: 15, sliceEnd: 35, nPts: 14 }, // Temporal R
  { cx: 256, cy: 380, rx: 60, ry: 40, sliceStart: 5, sliceEnd: 30, nPts: 16 },  // Occipital
  { cx: 256, cy: 420, rx: 70, ry: 35, sliceStart: 2, sliceEnd: 20, nPts: 20 },  // Cerebellum
  { cx: 220, cy: 240, rx: 25, ry: 18, sliceStart: 18, sliceEnd: 35, nPts: 12 }, // Ventricle L
  { cx: 292, cy: 240, rx: 25, ry: 18, sliceStart: 18, sliceEnd: 35, nPts: 12 }, // Ventricle R
  { cx: 240, cy: 265, rx: 20, ry: 15, sliceStart: 20, sliceEnd: 32, nPts: 10 }, // Thalamus
  { cx: 230, cy: 220, rx: 15, ry: 12, sliceStart: 22, sliceEnd: 34, nPts: 10 }, // Caudate
  { cx: 256, cy: 235, rx: 40, ry: 8, sliceStart: 20, sliceEnd: 36, nPts: 12 },  // Corpus callosum
  { cx: 256, cy: 255, rx: 10, ry: 30, sliceStart: 22, sliceEnd: 33, nPts: 10 }, // Internal capsule
];

export function generateDemoPolygonData(): PolygonData {
  const structures: Structure[] = STRUCTURES.map((s, i) => ({ ...s, id: i + 1 }));

  const slices: Record<string, Polygon[]> = {};

  for (let si = 0; si < 48; si++) {
    const polys: Polygon[] = [];
    for (let i = 0; i < STRUCT_CONFIGS.length; i++) {
      const cfg = STRUCT_CONFIGS[i];
      if (si >= cfg.sliceStart && si <= cfg.sliceEnd) {
        // Scale polygon size based on distance from center of visible range
        const mid = (cfg.sliceStart + cfg.sliceEnd) / 2;
        const dist = Math.abs(si - mid) / ((cfg.sliceEnd - cfg.sliceStart) / 2);
        const scale = 1 - dist * 0.4; // shrink towards edges

        polys.push({
          structureId: i + 1,
          points: generateOrganicPolygon(
            cfg.cx, cfg.cy,
            cfg.rx * scale, cfg.ry * scale,
            cfg.nPts, si * 1000 + i * 100 + 42
          ),
        });
      }
    }
    if (polys.length > 0) {
      slices[String(si)] = polys;
    }
  }

  return { structures, slices };
}

/**
 * Generate a synthetic MRI-like slice image on a canvas.
 * Returns a data URL for use as an image source.
 */
export function generateSliceImage(sliceIndex: number, width = 512, height = 512): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Dark background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  // Simulate brain outline — ellipse that varies with slice
  const cx = width / 2;
  const cy = height / 2;
  const sliceNorm = sliceIndex / 48;

  // Skull ellipse
  const skullRx = 180 - Math.abs(sliceNorm - 0.5) * 120;
  const skullRy = 200 - Math.abs(sliceNorm - 0.5) * 140;

  if (skullRx > 40 && skullRy > 40) {
    // Skull outline (bright)
    ctx.beginPath();
    ctx.ellipse(cx, cy, skullRx, skullRy, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a1a";
    ctx.fill();

    // Brain tissue (gray matter)
    ctx.beginPath();
    ctx.ellipse(cx, cy, skullRx * 0.92, skullRy * 0.9, 0, 0, Math.PI * 2);
    const brainGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, skullRx * 0.9);
    brainGrad.addColorStop(0, "#5a5a5a");
    brainGrad.addColorStop(0.5, "#4a4a4a");
    brainGrad.addColorStop(0.8, "#3a3a3a");
    brainGrad.addColorStop(1, "#2a2a2a");
    ctx.fillStyle = brainGrad;
    ctx.fill();

    // Ventricles (dark spots in center)
    if (sliceNorm > 0.35 && sliceNorm < 0.75) {
      const vSize = 12 + (1 - Math.abs(sliceNorm - 0.55) * 5) * 8;
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.ellipse(cx - 30, cy - 10, vSize, vSize * 0.7, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 30, cy - 10, vSize, vSize * 0.7, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Falx cerebri (midline)
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - skullRy * 0.88);
    ctx.lineTo(cx, cy + skullRy * 0.3);
    ctx.stroke();

    // Add noise texture for realism
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    // Simple seeded noise
    let seed = sliceIndex * 12345 + 67890;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 10) { // only add noise to non-black areas
        seed = (seed * 16807) % 2147483647;
        const noise = ((seed / 2147483647) - 0.5) * 16;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // Slice number watermark
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.font = "11px monospace";
  ctx.fillText(`Slice ${sliceIndex + 1}/48`, 10, height - 10);

  return canvas.toDataURL("image/png");
}
