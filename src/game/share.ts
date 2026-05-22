import { dateLabel } from "./daily";
import { MAX_SCORE } from "./config";
import type { RoundResult } from "./types";

/**
 * Elden Ring / medieval flavored tiers, best -> worst, keyed off the quality
 * score (0..100, before round multipliers).
 *   🌟 legendary · 👑 Elden Lord · ⚔️ valiant · 🛡️ steadfast · 🩸 bloodied · 💀 felled
 */
const TIERS: { min: number; emoji: string; label: string }[] = [
  { min: 95, emoji: "🌟", label: "Legendary" },
  { min: 80, emoji: "👑", label: "Elden Lord" },
  { min: 60, emoji: "⚔️", label: "Valiant" },
  { min: 40, emoji: "🛡️", label: "Steadfast" },
  { min: 20, emoji: "🩸", label: "Bloodied" },
  { min: 0, emoji: "💀", label: "Felled" },
];

export function tierFor(baseScore: number) {
  return TIERS.find((t) => baseScore >= t.min) ?? TIERS[TIERS.length - 1];
}

export function emojiFor(baseScore: number): string {
  return tierFor(baseScore).emoji;
}

/** The copy-paste result, e.g. "Elden Ring MapTap · May 22 …". */
export function buildShareText(
  results: RoundResult[],
  dateKey: string,
  total: number,
): string {
  const label = dateLabel(dateKey).replace(/ \d{4}$/, ""); // drop year for brevity
  const line = results
    .map((r) => `${String(r.baseScore).padStart(2, " ")}${emojiFor(r.baseScore)}`)
    .join("  ");
  return [
    `Elden Ring MapTap · ${label}`,
    line.trim(),
    `Grace: ${total}/${MAX_SCORE}`,
  ].join("\n");
}
