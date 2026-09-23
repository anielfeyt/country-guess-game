/**
 * One-off data pipeline: Natural Earth admin-0 → public/data/countries.geojson + distances.json.
 * Run with `pnpm data:build` (downloads into .cache/, takes ~1–2 minutes). Commit the output.
 */
import fs from "node:fs";
import path from "node:path";
import { geoArea } from "d3-geo";
import { topology } from "topojson-server";
import { neighbors } from "topojson-client";
import type { GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { COUNTRIES } from "../src/data/countries";
import type { CountryFeatureProps, DistanceTable } from "../src/lib/types";
import { buildShape, EARTH_RADIUS_KM, minDistanceKm } from "./lib/sphere";

const ROOT = process.cwd();
const CACHE = path.join(ROOT, ".cache", "naturalearth");
const OUT = path.join(ROOT, "public", "data");
const SOURCES = {
  "50m": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson",
  "10m": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson",
} as const;
/** Natural Earth splits these off; this game counts them as part of their UN-recognised country. */
const MERGE: Record<string, string> = { SOL: "SOM", CYN: "CYP" };

interface NEProps {
  ADM0_A3: string;
  ADMIN: string;
  LABEL_X: number;
  LABEL_Y: number;
}
type NEFeature = Feature<Polygon | MultiPolygon, NEProps>;

async function load(res: keyof typeof SOURCES): Promise<NEFeature[]> {
  const file = path.join(CACHE, `ne_${res}_admin_0_countries.geojson`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(CACHE, { recursive: true });
    console.log(`Downloading Natural Earth ${res}…`);
    const response = await fetch(SOURCES[res]);
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${SOURCES[res]}`);
    fs.writeFileSync(file, await response.text());
  }
  return (JSON.parse(fs.readFileSync(file, "utf8")) as FeatureCollection<Polygon | MultiPolygon, NEProps>).features;
}

const polygonsOf = (g: Polygon | MultiPolygon): Position[][][] => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

function roundPolygons(polys: Position[][][], dp: number): Position[][][] {
  const k = 10 ** dp;
  return polys.map((poly) => poly.map((ring) => ring.map(([x, y]) => [Math.round(x * k) / k, Math.round(y * k) / k])));
}

/** Area in km²; each polygon's winding is treated as "the smaller side" so flipped rings can't explode. */
function areaKm2(polys: Position[][][]): number {
  let steradians = 0;
  for (const coordinates of polys) {
    const a = geoArea({ type: "Polygon", coordinates });
    steradians += Math.min(a, 4 * Math.PI - a);
  }
  return Math.round(steradians * EARTH_RADIUS_KM ** 2);
}

async function main() {
  const [ne50, ne10] = await Promise.all([load("50m"), load("10m")]);
  const countryByA3 = new Map(COUNTRIES.map((c) => [c.a3, c]));

  // 1. Group 1:50m features by (merged) a3.
  const groups = new Map<string, { label: NEProps; polys: Position[][][] }>();
  for (const f of ne50) {
    const own = f.properties.ADM0_A3;
    const a3 = MERGE[own] ?? own;
    const group = groups.get(a3) ?? { label: f.properties, polys: [] };
    if (own === a3) group.label = f.properties;
    group.polys.push(...polygonsOf(f.geometry));
    groups.set(a3, group);
  }
  for (const c of COUNTRIES) {
    if (!groups.has(c.a3)) throw new Error(`No 1:50m geometry for ${c.name} (${c.a3})`);
  }

  // 2. Land neighbours = shared arcs in a 1:50m topology.
  const ids = [...groups.keys()];
  const topo = topology({
    countries: {
      type: "FeatureCollection",
      features: ids.map((id) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "MultiPolygon" as const, coordinates: groups.get(id)!.polys },
      })),
    },
  });
  const adjacency = neighbors((topo.objects.countries as GeometryCollection).geometries);
  const neighbourPairs = new Set<string>();
  adjacency.forEach((list, i) => list.forEach((j) => neighbourPairs.add(`${ids[i]}|${ids[j]}`)));

  // 3. Output features: 1:10m geometry for tiny countries, 1:50m for everything else.
  const ne10ByA3 = new Map(ne10.map((f) => [f.properties.ADM0_A3, f]));
  const features: Feature<MultiPolygon, CountryFeatureProps>[] = ids.map((a3) => {
    const group = groups.get(a3)!;
    const country = countryByA3.get(a3);
    let polys = group.polys;
    let dp = 3;
    if (country?.tiny) {
      const detailed = ne10ByA3.get(a3);
      if (!detailed) throw new Error(`No 1:10m geometry for tiny country ${country.name} (${a3})`);
      polys = polygonsOf(detailed.geometry);
      dp = 4;
    }
    const coordinates = roundPolygons(polys, dp);
    return {
      type: "Feature",
      properties: {
        a3,
        iso2: country?.iso2 ?? null,
        name: country?.name ?? group.label.ADMIN,
        playable: country !== undefined,
        tiny: country?.tiny === true,
        labelLat: group.label.LABEL_Y,
        labelLng: group.label.LABEL_X,
        areaKm2: areaKm2(coordinates),
      },
      geometry: { type: "MultiPolygon", coordinates },
    };
  });

  // 4. Distances between playable countries (upper triangle, COUNTRIES order).
  const featureByA3 = new Map(features.map((f) => [f.properties.a3, f]));
  const shapes = COUNTRIES.map((c) => buildShape(featureByA3.get(c.a3)!.geometry.coordinates));
  const km: number[] = [];
  const started = Date.now();
  for (let i = 0; i < COUNTRIES.length; i++) {
    for (let j = i + 1; j < COUNTRIES.length; j++) {
      const touching = neighbourPairs.has(`${COUNTRIES[i].a3}|${COUNTRIES[j].a3}`);
      km.push(touching ? 0 : Math.round(minDistanceKm(shapes[i], shapes[j])));
    }
    if (i % 20 === 0) console.log(`distances ${i}/${COUNTRIES.length} (${Math.round((Date.now() - started) / 1000)}s)`);
  }
  const table: DistanceTable = { ids: COUNTRIES.map((c) => c.iso2), km };

  // 5. Write.
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "countries.geojson"), JSON.stringify({ type: "FeatureCollection", features }));
  fs.writeFileSync(path.join(OUT, "distances.json"), JSON.stringify(table));
  console.log(`Wrote ${features.length} features and ${km.length} distances to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
