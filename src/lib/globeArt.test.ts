import { expect, test } from "vitest";
import { DEMO_SECRET, loadDemoRound, renderGlobeSvg } from "./globeArt";
import { WIN_COLOR } from "./heat";
import type { CountryFeature } from "./types";

const square = (iso2: string, lng: number): CountryFeature => ({
  type: "Feature",
  properties: { a3: iso2, iso2, name: iso2, playable: true, tiny: false, labelLat: 0, labelLng: lng, areaKm2: 1 },
  geometry: { type: "MultiPolygon", coordinates: [[[[lng, 0], [lng, 10], [lng + 10, 10], [lng + 10, 0], [lng, 0]]]] },
});

test("renderGlobeSvg fills guessed countries and skips the far hemisphere", () => {
  const svg = renderGlobeSvg([square("aa", 0), square("bb", 175)], {
    size: 100,
    rotate: [0, 0],
    colors: new Map([["aa", "#ff0000"], ["bb", "#00ff00"]]),
  });
  expect(svg.startsWith("<svg")).toBe(true);
  expect(svg).toContain('fill="#ff0000"');
  expect(svg).not.toContain('fill="#00ff00"');
});

test("loadDemoRound scores the demo guesses against the secret from the real data", async () => {
  const round = await loadDemoRound();
  const secret = round.guesses.find((g) => g.iso2 === DEMO_SECRET);
  expect(secret?.color).toBe(WIN_COLOR);
  expect(round.guesses.every((g) => g.km !== null)).toBe(true);
  expect(round.heatmap.get(DEMO_SECRET)).toBe(WIN_COLOR);
  expect(round.heatmap.size).toBeGreaterThan(150);
});
