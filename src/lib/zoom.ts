const RING_VISIBLE_ABOVE = 0.2;
const RING_HIDDEN_BELOW = 0.1;

/** Opacity of tiny-country marker rings: they fade out as the real shape becomes visible. */
export function ringAlpha(altitude: number): number {
  if (altitude >= RING_VISIBLE_ABOVE) return 1;
  if (altitude <= RING_HIDDEN_BELOW) return 0;
  return (altitude - RING_HIDDEN_BELOW) / (RING_VISIBLE_ABOVE - RING_HIDDEN_BELOW);
}

/** Camera altitude (globe radii) above which a country's overlay label is hidden. */
export function labelMaxAltitude(areaKm2: number): number {
  if (areaKm2 >= 1_000_000) return Infinity;
  if (areaKm2 >= 200_000) return 2.2;
  if (areaKm2 >= 30_000) return 1.2;
  if (areaKm2 >= 2_000) return 0.6;
  return 0.3;
}
