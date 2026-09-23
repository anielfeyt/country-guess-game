import { expect, test } from "vitest";
import { loadGameData } from "./loadData";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("loads features and builds a distance lookup", async () => {
  const fetchFn = async (url: string) =>
    url.endsWith("countries.geojson")
      ? json({ type: "FeatureCollection", features: [{ type: "Feature", properties: { iso2: "fr" }, geometry: null }] })
      : json({ ids: ["fr", "es"], km: [0] });
  const data = await loadGameData(fetchFn);
  expect(data.features).toHaveLength(1);
  expect(data.distance("fr", "es")).toBe(0);
});

test("rejects with the failing path on HTTP errors", async () => {
  const fetchFn = async (url: string) => (url.endsWith("distances.json") ? json({}, 404) : json({ features: [] }));
  await expect(loadGameData(fetchFn)).rejects.toThrow("/data/distances.json");
});
