import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { FeatureCollection, MultiPolygon } from "geojson";
import { createLocator } from "./locate";
import type { CountryFeature, CountryFeatureProps } from "./types";

const feature = (a3: string, areaKm2: number, polygons: number[][][][]): CountryFeature => ({
  type: "Feature",
  properties: { a3, iso2: a3.toLowerCase(), name: a3, playable: true, tiny: false, labelLat: 0, labelLng: 0, areaKm2 },
  geometry: { type: "MultiPolygon", coordinates: polygons },
});

// Clockwise exterior rings (d3-geo's spherical convention, as in Natural Earth).
const box = (w: number, s: number, e: number, n: number): number[][][] => [
  [[w, s], [w, n], [e, n], [e, s], [w, s]],
];

describe("createLocator (synthetic)", () => {
  const big = feature("BIG", 1_000_000, [box(0, 0, 10, 10)]);
  const enclave = feature("ENC", 100, [box(4, 4, 5, 5)]);
  const dateline = feature("DTL", 50_000, [box(179, -18, 180, -16), box(-180, -18, -179, -16)]);
  const locate = createLocator([big, enclave, dateline]);

  test("finds the country containing the point", () => {
    expect(locate(2, 2)?.properties.a3).toBe("BIG");
  });
  test("prefers the smallest containing country (enclaves)", () => {
    expect(locate(4.5, 4.5)?.properties.a3).toBe("ENC");
  });
  test("handles polygons on both sides of the antimeridian", () => {
    expect(locate(-17, 179.5)?.properties.a3).toBe("DTL");
    expect(locate(-17, -179.5)?.properties.a3).toBe("DTL");
  });
  test("returns null over the ocean", () => {
    expect(locate(-40, -30)).toBeNull();
  });
});

describe("createLocator (real data)", () => {
  const geo = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public", "data", "countries.geojson"), "utf8"),
  ) as FeatureCollection<MultiPolygon, CountryFeatureProps>;
  const locate = createLocator(geo.features);

  test.each([
    [48.85, 2.35, "fr"],
    [41.9029, 12.4534, "va"],
    [-33.87, 151.21, "au"],
    [55.75, 37.62, "ru"],
    [12.113, -61.68, "gd"],
  ])("(%f, %f) is in %s", (lat, lng, iso2) => {
    expect(locate(lat, lng)?.properties.iso2).toBe(iso2);
  });

  test("open ocean is not land", () => {
    for (const [lat, lng] of [[0, -30], [-40, 90], [30, -150], [-60, -120]]) {
      expect(locate(lat, lng), `${lat},${lng}`).toBeNull();
    }
  });
});
