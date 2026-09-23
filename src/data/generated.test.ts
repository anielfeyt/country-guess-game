import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { FeatureCollection, MultiPolygon } from "geojson";
import { COUNTRIES } from "./countries";
import { createDistanceLookup } from "@/src/lib/distance";
import type { CountryFeatureProps, DistanceTable } from "@/src/lib/types";

const read = <T,>(file: string): T =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", file), "utf8")) as T;

const geo = read<FeatureCollection<MultiPolygon, CountryFeatureProps>>("countries.geojson");
const table = read<DistanceTable>("distances.json");
const km = createDistanceLookup(table);

describe("countries.geojson", () => {
  test("every playable country has exactly one feature with geometry", () => {
    for (const c of COUNTRIES) {
      const matches = geo.features.filter((f) => f.properties.iso2 === c.iso2);
      expect(matches, c.name).toHaveLength(1);
      expect(matches[0].properties.playable).toBe(true);
      expect(matches[0].properties.tiny).toBe(c.tiny === true);
      expect(matches[0].geometry.coordinates.length, c.name).toBeGreaterThan(0);
    }
  });
  test("non-playable land has no iso2", () => {
    for (const f of geo.features.filter((f) => !f.properties.playable)) expect(f.properties.iso2).toBeNull();
  });
  test("Somaliland and Northern Cyprus are merged away", () => {
    const a3s = geo.features.map((f) => f.properties.a3);
    expect(a3s).not.toContain("SOL");
    expect(a3s).not.toContain("CYN");
  });
  test("every playable feature has a finite in-range label position", () => {
    for (const f of geo.features.filter((f) => f.properties.playable)) {
      const { labelLat, labelLng } = f.properties;
      expect(Number.isFinite(labelLat), f.properties.name).toBe(true);
      expect(Number.isFinite(labelLng), f.properties.name).toBe(true);
      expect(labelLat, f.properties.name).toBeGreaterThanOrEqual(-90);
      expect(labelLat, f.properties.name).toBeLessThanOrEqual(90);
      expect(labelLng, f.properties.name).toBeGreaterThanOrEqual(-180);
      expect(labelLng, f.properties.name).toBeLessThanOrEqual(180);
    }
  });
});

describe("distances.json", () => {
  test("covers all playable countries", () => {
    const n = COUNTRIES.length;
    expect(table.ids).toEqual(COUNTRIES.map((c) => c.iso2));
    expect(table.km).toHaveLength((n * (n - 1)) / 2);
    expect(table.km.every((v) => Number.isInteger(v) && v >= 0)).toBe(true);
  });
  test("land neighbours are 0 km", () => {
    expect(km("fr", "es")).toBe(0);
    expect(km("de", "pl")).toBe(0);
    expect(km("so", "et")).toBe(0);
    expect(km("it", "va")).toBe(0);
    expect(km("it", "sm")).toBe(0);
    expect(km("za", "ls")).toBe(0);
  });
  test("known sea gaps and long distances", () => {
    expect(km("gb", "fr")).toBeGreaterThan(0);
    expect(km("gb", "fr")).toBeLessThan(100);
    expect(km("gd", "vc")).toBeGreaterThan(0);
    expect(km("gd", "vc")).toBeLessThan(200);
    expect(km("au", "br")).toBeGreaterThan(8000);
  });
});
