import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { createDistanceLookup } from "./distance";
import { heatColor, WIN_COLOR } from "./heat";
import type { CountryFeature, DistanceTable } from "./types";

export const ART_SPACE = "#050814";
const OCEAN_LIGHT = "#15457a";
const OCEAN = "#0b2a4a";
const OCEAN_DARK = "#04111f";
const LAND = "#3f4a5a";
const ATMOSPHERE = "#5b8def";

export interface GlobeArtOptions {
  /** Width and height of the square SVG, in px. */
  size: number;
  /** d3 rotation: [-centerLng, -centerLat]. */
  rotate: [number, number];
  /** iso2 → fill; everything else is drawn as neutral land. */
  colors: ReadonlyMap<string, string>;
  land?: string;
  /** Country border stroke width in px; 0 disables borders. */
  borderWidth?: number;
  graticule?: boolean;
  /** Atmosphere halo around the sphere (shrinks the globe to make room). */
  glow?: boolean;
}

/** Static orthographic render of the game globe, as a standalone SVG string (for OG images and icons). */
export function renderGlobeSvg(features: CountryFeature[], opts: GlobeArtOptions): string {
  const { size, rotate, colors, land = LAND, borderWidth = 0, graticule = false, glow = false } = opts;
  const c = size / 2;
  const r = glow ? c * 0.86 : c * 0.98;
  const projection = geoOrthographic().rotate(rotate).scale(r).translate([c, c]).precision(0.3);
  const path = geoPath(projection).digits(1);

  const countries = features
    .map((f) => {
      const d = path(f);
      if (!d) return "";
      const fill = colors.get(f.properties.iso2 ?? "") ?? land;
      return `<path d="${d}" fill="${fill}"/>`;
    })
    .join("");

  const borders =
    borderWidth > 0
      ? `<g fill="none" stroke="${OCEAN_DARK}" stroke-width="${borderWidth}" stroke-linejoin="round" opacity="0.8">${features
          .map((f) => path(f))
          .filter(Boolean)
          .map((d) => `<path d="${d}"/>`)
          .join("")}</g>`
      : "";

  const grid = graticule
    ? `<path d="${path(geoGraticule10())}" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="${Math.max(size / 1000, 0.5)}"/>`
    : "";

  const halo = glow
    ? `<radialGradient id="halo" cx="${c}" cy="${c}" r="${c}" gradientUnits="userSpaceOnUse">
        <stop offset="${(r / c).toFixed(3)}" stop-color="${ATMOSPHERE}" stop-opacity="0.55"/>
        <stop offset="${((r / c + 1) / 2).toFixed(3)}" stop-color="${ATMOSPHERE}" stop-opacity="0.12"/>
        <stop offset="1" stop-color="${ATMOSPHERE}" stop-opacity="0"/>
      </radialGradient>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    ${halo}
    <radialGradient id="ocean" cx="0.36" cy="0.3" r="0.8">
      <stop offset="0" stop-color="${OCEAN_LIGHT}"/>
      <stop offset="0.55" stop-color="${OCEAN}"/>
      <stop offset="1" stop-color="${OCEAN_DARK}"/>
    </radialGradient>
    <radialGradient id="shade" cx="0.36" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/>
      <stop offset="0.5" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.55"/>
    </radialGradient>
  </defs>
  ${glow ? `<circle cx="${c}" cy="${c}" r="${c}" fill="url(#halo)"/>` : ""}
  <circle cx="${c}" cy="${c}" r="${r}" fill="url(#ocean)"/>
  ${grid}
  ${countries}
  ${borders}
  <circle cx="${c}" cy="${c}" r="${r}" fill="url(#shade)"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#9cc0ff" stroke-opacity="0.35" stroke-width="${Math.max(size / 400, 0.5)}"/>
</svg>`;
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** The sample round shown in the share image and icons: guesses closing in on Germany. */
export const DEMO_SECRET = "de";
export const DEMO_GUESSES = ["br", "eg", "es", "pl", "de"];

export interface DemoRound {
  features: CountryFeature[];
  guesses: { iso2: string; name: string; km: number | null; color: string }[];
  /** Guessed countries only. */
  colors: Map<string, string>;
  /** Every playable country coloured by its distance to the secret. */
  heatmap: Map<string, string>;
}

/** Reads the committed map data at build time and scores the demo guesses with the real distance table. */
export async function loadDemoRound(): Promise<DemoRound> {
  const dir = join(process.cwd(), "public", "data");
  const [geo, table] = await Promise.all([
    readFile(join(dir, "countries.geojson"), "utf8").then((t) => JSON.parse(t) as { features: CountryFeature[] }),
    readFile(join(dir, "distances.json"), "utf8").then((t) => JSON.parse(t) as DistanceTable),
  ]);
  const distance = createDistanceLookup(table);
  const nameOf = new Map(geo.features.map((f) => [f.properties.iso2, f.properties.name]));
  const guesses = DEMO_GUESSES.map((iso2) => {
    const km = distance(iso2, DEMO_SECRET);
    return { iso2, name: nameOf.get(iso2) ?? iso2, km, color: iso2 === DEMO_SECRET ? WIN_COLOR : heatColor(km) };
  });
  const heatmap = new Map(table.ids.map((iso2) => [iso2, iso2 === DEMO_SECRET ? WIN_COLOR : heatColor(distance(iso2, DEMO_SECRET))]));
  return { features: geo.features, guesses, colors: new Map(guesses.map((g) => [g.iso2, g.color])), heatmap };
}
