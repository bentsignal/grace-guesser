// Calibration helper: render graces (colored by region) over a downscaled map so
// the lat/lng -> image-pixel affine can be tuned visually.
//
// Transform (axis-aligned, north-up):
//   x_norm = AX * lng + BX        (0..1 across image width)
//   y_norm = AY * lat + BY        (0..1 down image height; AY<0 since north=up)
//
// Usage: node scripts/overlay.mjs AX BX AY BY
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// 6-param affine: x_norm = a*lng + b*lat + c ; y_norm = d*lng + e*lat + f
const [a, b, c, d, e, f] = process.argv.slice(2).map(Number);
if ([a, b, c, d, e, f].some((n) => !Number.isFinite(n))) {
  console.error("usage: node scripts/overlay.mjs a b c d e f");
  process.exit(1);
}

const graces = JSON.parse(fs.readFileSync(path.join(root, "src/data/graces.json"), "utf8"));
const COLORS = {
  "Weeping Peninsula": "#e879f9",
  "Limgrave": "#22c55e",
  "Caelid": "#ef4444",
  "Liurnia of the Lakes": "#3b82f6",
  "Altus Plateau": "#eab308",
  "Mt. Gelmir": "#f97316",
  "Leyndell, Royal Capital": "#fcd34d",
  "Mountaintops of the Giants": "#a855f7",
  "Consecrated Snowfield": "#06b6d4",
  "Miquella's Haligtree": "#ec4899",
};

const W = 1200;
const meta = await sharp(path.join(root, "public/map/lod_0.jpeg")).metadata();
const H = Math.round((meta.height / meta.width) * W);

const dots = graces
  .map((g) => {
    const x = (a * g.lng + b * g.lat + c) * W;
    const y = (d * g.lng + e * g.lat + f) * H;
    const col = COLORS[g.region] || "#ffffff";
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${col}" stroke="#000" stroke-width="0.6"/>`;
  })
  .join("");

const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${dots}</svg>`;

await sharp(path.join(root, "public/map/lod_0.jpeg"))
  .resize(W, H)
  .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
  .png()
  .toFile("/tmp/overlay.png");

// also print bounds for reference
const lat = graces.map((g) => g.lat), lng = graces.map((g) => g.lng);
console.log(`graces lat ${Math.min(...lat).toFixed(3)}..${Math.max(...lat).toFixed(3)}  lng ${Math.min(...lng).toFixed(3)}..${Math.max(...lng).toFixed(3)}`);
console.log(`image ${meta.width}x${meta.height}  overlay ${W}x${H}`);
console.log(`wrote /tmp/overlay.png`);
