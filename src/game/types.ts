export interface Grace {
  id: number;
  name: string;
  region: string;
  /** normalized 0..1 across the map width (left -> right) */
  x: number;
  /** normalized 0..1 down the map height (top -> bottom) */
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface RoundConfig {
  /** point multiplier; round max = 100 * multiplier */
  multiplier: number;
  /** whether the region is revealed as a hint */
  showRegion: boolean;
}

export interface RoundResult {
  guess: Point;
  /** distance in map-width fractions */
  distance: number;
  /** quality 0..100 before the multiplier */
  baseScore: number;
  /** baseScore * multiplier */
  roundScore: number;
}
