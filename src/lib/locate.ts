import { geoBounds, geoContains } from "d3-geo";
import type { CountryFeature } from "./types";

type Locator = (lat: number, lng: number) => CountryFeature | null;

interface Candidate {
  feature: CountryFeature;
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Point-in-country lookup for hover. Smallest countries are tested first so enclaves win over their host. */
export function createLocator(features: CountryFeature[]): Locator {
  const candidates: Candidate[] = [...features]
    .sort((a, b) => a.properties.areaKm2 - b.properties.areaKm2)
    .map((feature) => {
      const [[west, south], [east, north]] = geoBounds(feature);
      return { feature, west, south, east, north };
    });

  return (lat, lng) => {
    for (const c of candidates) {
      if (lat < c.south || lat > c.north) continue;
      // Bounds crossing the antimeridian have west > east.
      const inLng = c.west <= c.east ? lng >= c.west && lng <= c.east : lng >= c.west || lng <= c.east;
      if (inLng && geoContains(c.feature, [lng, lat])) return c.feature;
    }
    return null;
  };
}
