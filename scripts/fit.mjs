// Least-squares fit of a 6-param affine (lng,lat) -> (x_norm,y_norm) from hand-read
// landmark correspondences, then render the overlay to verify.
import { execSync } from "node:child_process";

// correspondences: [lng, lat, x_norm, y_norm]  (read from /tmp/grid.png)
const C = [
  [-0.697, 0.780, 0.43, 0.40], // Leyndell / Erdtree glow
  [-0.660, 0.636, 0.55, 0.64], // Caelid scarlet rot (Aeonia)
  [-0.790, 0.800, 0.20, 0.30], // Mt. Gelmir caldera
  [-0.700, 0.578, 0.37, 0.84], // Castle Morne (Weeping, south)
  [-0.652, 0.813, 0.55, 0.20], // Consecrated Snowfield (white, north-center)
  [-0.645, 0.890, 0.60, 0.10], // Haligtree (far north)
  [-0.805, 0.721, 0.225, 0.495], // Raya Lucaria Academy (Liurnia lake)
];

function solve3(rows, targets) {
  // normal equations A^T A x = A^T b, A rows = [lng,lat,1]
  const ATA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const ATb = [0, 0, 0];
  for (let i = 0; i < rows.length; i++) {
    const r = [rows[i][0], rows[i][1], 1];
    for (let p = 0; p < 3; p++) {
      for (let q = 0; q < 3; q++) ATA[p][q] += r[p] * r[q];
      ATb[p] += r[p] * targets[i];
    }
  }
  // Gaussian elimination 3x3
  const M = ATA.map((row, i) => [...row, ATb[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const fac = M[r][col] / M[col][col];
      for (let k = col; k <= 3; k++) M[r][k] -= fac * M[col][k];
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

const rows = C.map((p) => [p[0], p[1]]);
const [a, b, c] = solve3(rows, C.map((p) => p[2]));
const [d, e, f] = solve3(rows, C.map((p) => p[3]));

// residuals
console.log("x = %s*lng + %s*lat + %s", a.toFixed(4), b.toFixed(4), c.toFixed(4));
console.log("y = %s*lng + %s*lat + %s", d.toFixed(4), e.toFixed(4), f.toFixed(4));
let maxr = 0;
for (const p of C) {
  const px = a * p[0] + b * p[1] + c, py = d * p[0] + e * p[1] + f;
  const r = Math.hypot(px - p[2], py - p[3]);
  maxr = Math.max(maxr, r);
}
console.log("max residual:", maxr.toFixed(4));

const args = [a, b, c, d, e, f].map((n) => n.toFixed(6)).join(" ");
console.log("\nrendering:", args);
execSync(`node scripts/overlay.mjs ${args}`, { stdio: "inherit" });
