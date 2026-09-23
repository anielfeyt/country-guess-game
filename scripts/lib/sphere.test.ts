import { describe, expect, test } from "vitest";
import { angle, buildShape, EARTH_RADIUS_KM, minDistanceKm, pointToArc, toVec } from "./sphere";

const ONE_DEG_KM = (Math.PI / 180) * EARTH_RADIUS_KM; // ≈ 111.19

const square = (lng: number, lat: number, size: number): number[][][][] => [
  [[[lng, lat], [lng + size, lat], [lng + size, lat + size], [lng, lat + size], [lng, lat]]],
];

describe("vectors", () => {
  test("toVec puts (0,0) on the x axis", () => {
    const [x, y, z] = toVec(0, 0);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(0);
  });
  test("angle between equator points 90° apart", () => {
    expect(angle(toVec(0, 0), toVec(90, 0))).toBeCloseTo(Math.PI / 2);
  });
});

describe("pointToArc", () => {
  test("perpendicular distance to the middle of an arc", () => {
    const d = pointToArc(toVec(0, 1), toVec(-1, 0), toVec(1, 0)) * EARTH_RADIUS_KM;
    expect(d).toBeCloseTo(ONE_DEG_KM, 0);
  });
  test("falls back to the nearest endpoint beyond the arc", () => {
    const d = pointToArc(toVec(3, 0), toVec(-1, 0), toVec(1, 0)) * EARTH_RADIUS_KM;
    expect(d).toBeCloseTo(2 * ONE_DEG_KM, 0);
  });
});

describe("minDistanceKm", () => {
  test("two squares 1° apart at the equator", () => {
    const d = minDistanceKm(buildShape(square(0, 0, 1)), buildShape(square(2, 0, 1)));
    expect(d).toBeCloseTo(ONE_DEG_KM, 0);
  });
  test("works across the antimeridian", () => {
    // 178°..179° and -180°..-179° are 1° apart across the dateline.
    const d = minDistanceKm(buildShape(square(178, 0, 1)), buildShape(square(-180, 0, 1)));
    expect(d).toBeCloseTo(ONE_DEG_KM, 0);
  });
  test("touching shapes are 0 km apart", () => {
    const d = minDistanceKm(buildShape(square(0, 0, 1)), buildShape(square(1, 0, 1)));
    expect(d).toBeLessThan(0.001);
  });
  test("distance from a point to the middle of a long edge (not just vertices)", () => {
    // Big square's top edge runs lng 0..10 at lat 0; the small square sits 1° above its middle.
    const big = buildShape([[[[0, -10], [10, -10], [10, 0], [0, 0], [0, -10]]]]);
    const small = buildShape(square(4.9, 1, 0.2));
    expect(minDistanceKm(big, small)).toBeCloseTo(ONE_DEG_KM, -1);
  });
});
