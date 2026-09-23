import type { Feature, MultiPolygon } from "geojson";

export interface CountryFeatureProps {
  a3: string;
  /** null for drawn-but-not-playable land (territories, Antarctica). */
  iso2: string | null;
  name: string;
  playable: boolean;
  tiny: boolean;
  labelLat: number;
  labelLng: number;
  areaKm2: number;
}

export type CountryFeature = Feature<MultiPolygon, CountryFeatureProps>;

/** Nearest-border km between playable countries. `km` is the upper triangle (i < j), row-major. */
export interface DistanceTable {
  ids: string[];
  km: number[];
}
