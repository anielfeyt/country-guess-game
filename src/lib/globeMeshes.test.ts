import { beforeAll, expect, test, vi } from "vitest";
import type { CountryFeature } from "./types";

// three-conic-polygon-geometry reads `window.THREE` at import time (a browser global).
let buildLandMesh: typeof import("./globeMeshes").buildLandMesh;
let buildBorderLines: typeof import("./globeMeshes").buildBorderLines;
beforeAll(async () => {
  vi.stubGlobal("window", globalThis);
  ({ buildLandMesh, buildBorderLines } = await import("./globeMeshes"));
});

const feature = (a3: string, polygons: number[][][][]): CountryFeature => ({
  type: "Feature",
  properties: { a3, iso2: null, name: a3, playable: false, tiny: false, labelLat: 0, labelLng: 0, areaKm2: 1 },
  geometry: { type: "MultiPolygon", coordinates: polygons },
});

const features = [
  feature("A", [[[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]], [[[20, 0], [20, 5], [25, 5], [25, 0], [20, 0]]]]),
  feature("B", [[[[-50, -10], [-50, 0], [-40, 0], [-40, -10], [-50, -10]]]]),
];

test("buildLandMesh merges every polygon of every feature into one mesh on the globe surface", () => {
  const mesh = buildLandMesh(features, 100, 0.002, "#3f4a5a");
  expect(mesh.isMesh).toBe(true);
  expect(mesh.geometry.getAttribute("position").count).toBeGreaterThan(0);
  expect(mesh.scale.x).toBeCloseTo(1.002);
  const pos = mesh.geometry.getAttribute("position");
  const r = Math.hypot(pos.getX(0), pos.getY(0), pos.getZ(0));
  expect(r).toBeCloseTo(100, 0);
});

test("buildBorderLines draws all outlines as one line object", () => {
  const lines = buildBorderLines(features, 100, 0.0025, "#ffffff", 0.45);
  expect(lines.isLineSegments).toBe(true);
  expect(lines.geometry.getAttribute("position").count).toBeGreaterThan(0);
  expect(lines.scale.x).toBeCloseTo(1.0025);
});
