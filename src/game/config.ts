import type { RoundConfig } from "./types";

/** Natural pixel size of the full-resolution Lands Between map (used for the Leaflet CRS). */
export const MAP_WIDTH = 9728;
export const MAP_HEIGHT = 9216;
export const MAP_ASPECT = MAP_HEIGHT / MAP_WIDTH;
export const MAP_IMAGE_PREVIEW = "/map/lands-between-preview.jpg";
export const MAP_IMAGE_MEDIUM = "https://bbh15z1amz.ufs.sh/f/QNb0Pk2bBKVcKFLSLjDirKuya3siNfjOSAVEwCzHRoIhGB24";
export const MAP_IMAGE_FULL = "https://bbh15z1amz.ufs.sh/f/QNb0Pk2bBKVcMmHzrHp69oh70FHzRabNJZmOtWCYsSKxjTGA";
export const MAP_IMAGES = [MAP_IMAGE_PREVIEW, MAP_IMAGE_MEDIUM, MAP_IMAGE_FULL].filter(Boolean);

/**
 * Five rounds of rising stakes. The grace name is always shown; the region hint
 * fades after round 3, and later rounds are worth more.
 *   100 + 100 + 200 + 300 + 300 = 1000 points.
 */
export const ROUNDS: RoundConfig[] = [
  { multiplier: 1, showRegion: true },
  { multiplier: 1, showRegion: true },
  { multiplier: 2, showRegion: true },
  { multiplier: 3, showRegion: false },
  { multiplier: 3, showRegion: false },
];

export const ROUND_COUNT = ROUNDS.length;
export const MAX_SCORE = ROUNDS.reduce((s, r) => s + 100 * r.multiplier, 0);
