import type { RoundConfig } from "./types";

/** Natural pixel size of public/map/lands-between.jpg (used for the Leaflet CRS). */
export const MAP_WIDTH = 4096;
export const MAP_HEIGHT = 3880;
export const MAP_ASPECT = MAP_HEIGHT / MAP_WIDTH;
export const MAP_IMAGE = "/map/lands-between.jpg";

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
