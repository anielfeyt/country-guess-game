import { DoubleSide, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import ConicPolygonGeometry from "three-conic-polygon-geometry";
import GeoJsonGeometry from "three-geojson-geometry";
import type { CountryFeature } from "./types";

// Same tessellation three-globe uses for polygon caps and strokes (degrees).
const CURVATURE_RESOLUTION = 5;

/**
 * All land as ONE mesh. three-globe's polygon layer makes a separate cap mesh (plus side wall and stroke)
 * per polygon — ~1,900 draw calls for Natural Earth's islands — which made the globe draw-call bound.
 */
export function buildLandMesh(features: CountryFeature[], radius: number, altitude: number, color: string): Mesh {
  const geometries = features.flatMap((f) =>
    f.geometry.coordinates.map(
      (polygon) => new ConicPolygonGeometry(polygon, 0, radius, false, true, false, CURVATURE_RESOLUTION),
    ),
  );
  const merged = mergeGeometries(geometries, false);
  geometries.forEach((g) => g.dispose());
  if (!merged) throw new Error("Could not merge land geometries");
  const mesh = new Mesh(merged, new MeshBasicMaterial({ color, side: DoubleSide }));
  mesh.scale.setScalar(1 + altitude);
  return mesh;
}

/** Every country outline as ONE line object (the names & borders overlay). */
export function buildBorderLines(
  features: CountryFeature[],
  radius: number,
  altitude: number,
  color: string,
  opacity: number,
): LineSegments {
  const geometry = new GeoJsonGeometry(
    { type: "MultiPolygon", coordinates: features.flatMap((f) => f.geometry.coordinates) },
    radius,
    CURVATURE_RESOLUTION,
  );
  const lines = new LineSegments(geometry, new LineBasicMaterial({ color, transparent: true, opacity }));
  lines.scale.setScalar(1 + altitude);
  return lines;
}
