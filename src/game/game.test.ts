import { describe, expect, it } from "vitest";
import { GRACES, selectDaily, todayKey, dateLabel } from "./daily";
import { baseScore, mapDistance, scoreRound, totalScore } from "./scoring";
import { buildShareText, emojiFor } from "./share";
import { MAX_SCORE, ROUND_COUNT, ROUNDS } from "./config";

describe("data", () => {
  it("loads above-ground graces with normalized coords", () => {
    expect(GRACES.length).toBeGreaterThan(200);
    for (const g of GRACES) {
      expect(g.x).toBeGreaterThanOrEqual(0);
      expect(g.x).toBeLessThanOrEqual(1);
      expect(g.y).toBeGreaterThanOrEqual(0);
      expect(g.y).toBeLessThanOrEqual(1);
      expect(g.region).toBeTruthy();
    }
  });
});

describe("selectDaily", () => {
  it("is deterministic for a given date", () => {
    const a = selectDaily("2026-05-22");
    const b = selectDaily("2026-05-22");
    expect(a.map((g) => g.id)).toEqual(b.map((g) => g.id));
  });

  it("returns the right count of distinct graces", () => {
    const picks = selectDaily("2026-05-22");
    expect(picks).toHaveLength(ROUND_COUNT);
    expect(new Set(picks.map((g) => g.id)).size).toBe(ROUND_COUNT);
  });

  it("spans distinct regions", () => {
    const picks = selectDaily("2026-05-22");
    expect(new Set(picks.map((g) => g.region)).size).toBe(ROUND_COUNT);
  });

  it("varies across dates", () => {
    const a = selectDaily("2026-05-22").map((g) => g.id);
    const b = selectDaily("2026-05-23").map((g) => g.id);
    expect(a).not.toEqual(b);
  });
});

describe("scoring", () => {
  it("awards 100 for a perfect guess", () => {
    expect(baseScore(0)).toBe(100);
  });

  it("decreases monotonically with distance", () => {
    expect(baseScore(0.02)).toBeGreaterThan(baseScore(0.1));
    expect(baseScore(0.1)).toBeGreaterThan(baseScore(0.3));
  });

  it("gives ~50 at the half-score distance", () => {
    expect(baseScore(0.1443)).toBeGreaterThanOrEqual(49);
    expect(baseScore(0.1443)).toBeLessThanOrEqual(51);
  });

  it("applies the round multiplier", () => {
    const actual = { x: 0.5, y: 0.5 };
    const r = scoreRound({ x: 0.5, y: 0.5 }, actual, 2); // round 3 -> x2
    expect(r.baseScore).toBe(100);
    expect(r.roundScore).toBe(200);
  });

  it("aspect-corrects the y axis", () => {
    // a full vertical span is scaled to map-width fractions (image is 4096x3880)
    const d = mapDistance({ x: 0, y: 0 }, { x: 0, y: 1 });
    expect(d).toBeCloseTo(3880 / 4096, 2);
  });

  it("perfect game equals MAX_SCORE", () => {
    const results = ROUNDS.map((_, i) =>
      scoreRound({ x: 0.4, y: 0.4 }, { x: 0.4, y: 0.4 }, i),
    );
    expect(totalScore(results)).toBe(MAX_SCORE);
  });
});

describe("share", () => {
  it("maps scores to medieval tiers", () => {
    expect(emojiFor(100)).toBe("🌟");
    expect(emojiFor(0)).toBe("💀");
  });

  it("builds a copy-paste summary", () => {
    const results = [100, 88, 80, 87, 25].map((_b, i) =>
      scoreRound({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, i),
    );
    // override baseScore for a representative line
    results.forEach((r, i) => {
      r.baseScore = [100, 88, 80, 87, 25][i];
    });
    const text = buildShareText(results, "2026-05-22", 679);
    expect(text).toContain("Elden Ring Grace Guesser · May 22");
    expect(text).toContain("Runes: 679/1000");
    expect(text).toContain("💍 www.grace-guesser.com");
  });
});

describe("date helpers", () => {
  it("formats keys", () => {
    expect(todayKey(new Date(2026, 4, 22))).toBe("2026-05-22");
    expect(dateLabel("2026-05-22")).toBe("May 22 2026");
  });
});
