import { describe, expect, test } from "vitest";
import { heatColor, hexToRgb, MAX_KM, UNKNOWN_COLOR } from "./heat";

const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe("heatColor", () => {
  test("endpoints", () => {
    expect(heatColor(0)).toBe("#b3001b");
    expect(heatColor(MAX_KM)).toBe("#fff3d6");
  });
  test("clamps beyond MAX_KM and below 0", () => {
    expect(heatColor(20000)).toBe("#fff3d6");
    expect(heatColor(-5)).toBe("#b3001b");
  });
  test("unknown distance is neutral", () => {
    expect(heatColor(null)).toBe(UNKNOWN_COLOR);
  });
  test("gets lighter as distance grows", () => {
    let prev = -1;
    for (let km = 0; km <= MAX_KM; km += 250) {
      const l = luminance(heatColor(km));
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
  });
});

describe("hexToRgb", () => {
  test("parses #rrggbb", () => {
    expect(hexToRgb("#1fbf5b")).toEqual([31, 191, 91]);
  });
});
