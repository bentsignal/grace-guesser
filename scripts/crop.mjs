// Crop the full-res map around a center (given as global 0..1 fractions) and overlay
// a fine grid labeled in GLOBAL fractions, so landmark pixel positions can be read
// directly for affine calibration.
// Usage: node scripts/crop.mjs cx cy [span] [outname]
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const [cx, cy, span = 0.22, name = "crop"] = process.argv.slice(2);
const CX = Number(cx), CY = Number(cy), SP = Number(span);

const img = sharp(path.join(root, "public/map/lod_0.jpeg"));
const meta = await img.metadata();
const W = meta.width, H = meta.height;

const left = Math.round((CX - SP / 2) * W);
const top = Math.round((CY - SP / 2) * H);
const cw = Math.round(SP * W);
const ch = Math.round(SP * H);

const OUT = 900;
const scale = OUT / cw;
const outH = Math.round(ch * scale);

// grid lines every 0.02 in global fractions
let g = "";
for (let gx = Math.ceil((CX - SP / 2) / 0.02) * 0.02; gx < CX + SP / 2; gx += 0.02) {
  const px = (gx - (CX - SP / 2)) * W * scale;
  g += `<line x1="${px}" y1="0" x2="${px}" y2="${outH}" stroke="#0ff" stroke-width="1" opacity="0.5"/>`;
  g += `<text x="${px + 1}" y="12" fill="#0ff" font-size="11">${gx.toFixed(2)}</text>`;
}
for (let gy = Math.ceil((CY - SP / 2) / 0.02) * 0.02; gy < CY + SP / 2; gy += 0.02) {
  const py = (gy - (CY - SP / 2)) * H * scale;
  g += `<line x1="0" y1="${py}" x2="${OUT}" y2="${py}" stroke="#0ff" stroke-width="1" opacity="0.5"/>`;
  g += `<text x="1" y="${py - 1}" fill="#0ff" font-size="11">${gy.toFixed(2)}</text>`;
}
const svg = `<svg width="${OUT}" height="${outH}" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;

await sharp(path.join(root, "public/map/lod_0.jpeg"))
  .extract({ left, top, width: cw, height: ch })
  .resize(OUT, outH)
  .composite([{ input: Buffer.from(svg) }])
  .png()
  .toFile(`/tmp/${name}.png`);
console.log(`wrote /tmp/${name}.png  (center ${CX},${CY} span ${SP})`);
