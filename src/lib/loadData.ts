import type { FeatureCollection, MultiPolygon } from "geojson";
import { createDistanceLookup, type DistanceLookup } from "./distance";
import type { CountryFeature, CountryFeatureProps, DistanceTable } from "./types";

export interface GameData {
  features: CountryFeature[];
  distance: DistanceLookup;
}

type FetchFn = (url: string) => Promise<Response>;

async function getJson<T>(fetchFn: FetchFn, url: string): Promise<T> {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Failed to load ${url} (HTTP ${response.status})`);
  return (await response.json()) as T;
}

export async function loadGameData(fetchFn: FetchFn = (url) => fetch(url)): Promise<GameData> {
  const [geo, table] = await Promise.all([
    getJson<FeatureCollection<MultiPolygon, CountryFeatureProps>>(fetchFn, "/data/countries.geojson"),
    getJson<DistanceTable>(fetchFn, "/data/distances.json"),
  ]);
  return { features: geo.features, distance: createDistanceLookup(table) };
}
