import gracesData from "../data/graces.json";
import type { Grace } from "./types";
import { ROUND_COUNT } from "./config";

export const GRACES = gracesData as Grace[];
const RECENT_DAILY_COOLDOWN_DAYS = 7;
const SCHEDULE_EPOCH_DAY = dayNumber("2026-01-01");

/** Local calendar date as YYYY-MM-DD (the puzzle key; resets at local midnight). */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Human label like "May 22 2026" for a YYYY-MM-DD key. */
export function dateLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d} ${y}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function keyFromDayNumber(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** Deterministic 32-bit hash of a string (FNV-1a). */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 seeded PRNG -> deterministic float in [0,1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using a seeded rng (does not mutate input). */
function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick the day's graces deterministically from the date key. Greedily prefers
 * graces from distinct regions so the five rounds span the map.
 */
function selectDailyRaw(key: string, pool: Grace[], recentIds: ReadonlySet<number>): Grace[] {
  const rng = mulberry32(hashStr(`eldenring-grace-guesser:${key}`));
  const shuffled = shuffle(pool, rng);

  const picked: Grace[] = [];
  const usedRegions = new Set<string>();
  for (const g of shuffled) {
    if (recentIds.has(g.id)) continue;
    if (usedRegions.has(g.region)) continue;
    picked.push(g);
    usedRegions.add(g.region);
    if (picked.length === ROUND_COUNT) break;
  }
  // Fallback (fewer regions than rounds): top up with any remaining graces.
  if (picked.length < ROUND_COUNT) {
    for (const g of shuffled) {
      if (recentIds.has(g.id)) continue;
      if (picked.includes(g)) continue;
      picked.push(g);
      if (picked.length === ROUND_COUNT) break;
    }
  }
  if (picked.length < ROUND_COUNT) {
    for (const g of shuffled) {
      if (picked.includes(g)) continue;
      picked.push(g);
      if (picked.length === ROUND_COUNT) break;
    }
  }
  return picked;
}

export function selectDaily(key: string, pool: Grace[] = GRACES): Grace[] {
  const targetDay = dayNumber(key);
  const firstDay = Math.min(SCHEDULE_EPOCH_DAY, targetDay);
  const recent: Grace[][] = [];

  let picks: Grace[] = [];
  for (let day = firstDay; day <= targetDay; day++) {
    const recentIds = new Set(recent.flat().map((g) => g.id));
    picks = selectDailyRaw(keyFromDayNumber(day), pool, recentIds);
    recent.push(picks);
    if (recent.length > RECENT_DAILY_COOLDOWN_DAYS) recent.shift();
  }

  return picks;
}
