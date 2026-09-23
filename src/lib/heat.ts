export const MAX_KM = 8000;
export const WIN_COLOR = "#1fbf5b";
export const UNKNOWN_COLOR = "#9aa0a6";

type RGB = [number, number, number];

const STOPS: ReadonlyArray<readonly [number, RGB]> = [
  [0, [0xb3, 0x00, 0x1b]],
  [0.35, [0xe8, 0x54, 0x1e]],
  [0.65, [0xf7, 0xb5, 0x38]],
  [1, [0xff, 0xf3, 0xd6]],
];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: RGB) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** Deep red for neighbours → pale cream for ≥ MAX_KM. sqrt spreads the near range. */
export function heatColor(km: number | null): string {
  if (km === null) return UNKNOWN_COLOR;
  const t = Math.sqrt(Math.min(Math.max(km, 0), MAX_KM) / MAX_KM);
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    if (t <= t1) {
      const [t0, c0] = STOPS[i - 1];
      const f = (t - t0) / (t1 - t0);
      return toHex([0, 1, 2].map((k) => c0[k] + (c1[k] - c0[k]) * f) as RGB);
    }
  }
  return toHex(STOPS[STOPS.length - 1][1]);
}
