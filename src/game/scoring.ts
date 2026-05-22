import { MAP_ASPECT, ROUNDS } from "./config";
import type { Point, RoundResult } from "./types";

/** Half-score distance: a guess this far off (in map-width fractions) scores 50. */
const HALF_SCORE_DISTANCE = 0.1443; // ~14% of map width

/**
 * Distance between two normalized points in map-WIDTH fractions. The y axis is
 * scaled by the map aspect so a pixel north counts the same as a pixel east.
 */
export function mapDistance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = (a.y - b.y) * MAP_ASPECT;
  return Math.hypot(dx, dy);
}

/** Quality score 0..100 from a distance (exponential falloff, 100 at d=0). */
export function baseScore(distance: number): number {
  const s = 100 * Math.exp((-distance / HALF_SCORE_DISTANCE) * Math.LN2);
  return Math.round(Math.max(0, Math.min(100, s)));
}

/** Score a single round's guess against the true point. */
export function scoreRound(guess: Point, actual: Point, roundIndex: number): RoundResult {
  const distance = mapDistance(guess, actual);
  const base = baseScore(distance);
  const multiplier = ROUNDS[roundIndex]?.multiplier ?? 1;
  return {
    guess,
    distance,
    baseScore: base,
    roundScore: base * multiplier,
  };
}

export function totalScore(results: RoundResult[]): number {
  return results.reduce((s, r) => s + r.roundScore, 0);
}
