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

/**
 * Camera clip planes for a given altitude (globe radii). globe.gl's defaults (near 0.05, far 125,000) leave
 * ~0.075 units of depth precision at normal viewing distance, so caps, strokes and ocean z-fight. Scaling
 * near with the distance to the surface keeps precision far below the smallest gap between layers.
 */
export function depthRange(altitude: number, radius: number): { near: number; far: number } {
  return { near: Math.max(0.05, altitude * radius * 0.3), far: radius * (altitude + 3) };
}
