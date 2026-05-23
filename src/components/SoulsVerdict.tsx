interface Verdict {
  text: string;
  /** glow + fill color: death-red for a miss, victory-gold for a great guess */
  color: string;
}

/** A guess only earns a splash at the extremes; nothing in the middle. */
function verdictFor(score: number): Verdict | null {
  if (score <= 30) return { text: "u suck", color: "#c01818" };
  if (score >= 90) return { text: "not bad tbh", color: "#ecd08a" };
  return null;
}

/**
 * Souls-style splash shown over the map after a guess. Two faint glowing copies
 * of the line slide in from either side and overlap in the center, mirroring the
 * game's "YOU DIED" / "ENEMY FELLED" text. Render with a per-round `key` so it
 * remounts and the animation replays each time.
 */
export function SoulsVerdict({ score }: { score: number }) {
  const verdict = verdictFor(score);
  if (!verdict) return null;

  const glow = {
    color: verdict.color,
    textShadow: `0 0 8px ${verdict.color}, 0 0 28px ${verdict.color}`,
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1050] overflow-hidden"
      aria-hidden
    >
      <div className="souls-verdict-backdrop" />
      <div className="souls-verdict-layer souls-verdict-layer--left">
        <span className="souls-verdict" style={glow}>
          {verdict.text}
        </span>
      </div>
      <div className="souls-verdict-layer souls-verdict-layer--right">
        <span className="souls-verdict" style={glow}>
          {verdict.text}
        </span>
      </div>
    </div>
  );
}
