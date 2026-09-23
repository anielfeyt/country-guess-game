export type Vec3 = readonly [number, number, number];

export const EARTH_RADIUS_KM = 6371;
const COARSE_SAMPLES = 300;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => {
  const n = length(a);
  return [a[0] / n, a[1] / n, a[2] / n];
};

export function toVec(lng: number, lat: number): Vec3 {
  const l = (lng * Math.PI) / 180;
  const p = (lat * Math.PI) / 180;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}

/** Central angle in radians (numerically stable for tiny angles). */
export function angle(a: Vec3, b: Vec3): number {
  return Math.atan2(length(cross(a, b)), dot(a, b));
}

/** Angle from p to the minor great-circle arc a→b. */
export function pointToArc(p: Vec3, a: Vec3, b: Vec3): number {
  const n = cross(a, b);
  const nl = length(n);
  if (nl < 1e-12) return angle(p, a);
  const nn: Vec3 = [n[0] / nl, n[1] / nl, n[2] / nl];
  const d = dot(p, nn);
  const proj: Vec3 = [p[0] - d * nn[0], p[1] - d * nn[1], p[2] - d * nn[2]];
  const withinArc = dot(cross(a, proj), nn) >= 0 && dot(cross(proj, b), nn) >= 0;
  if (withinArc) return Math.abs(Math.asin(Math.max(-1, Math.min(1, d))));
  return Math.min(angle(p, a), angle(p, b));
}

export interface Shape {
  pts: Vec3[];
  segs: [Vec3, Vec3][];
  center: Vec3;
  /** Max angle from center to any vertex. */
  radius: number;
  /** Longest segment, as an angle. */
  maxSeg: number;
  coarse: Vec3[];
}

export function buildShape(multiPolygon: number[][][][]): Shape {
  const pts: Vec3[] = [];
  const segs: [Vec3, Vec3][] = [];
  let maxSeg = 0;
  for (const polygon of multiPolygon) {
    for (const ring of polygon) {
      const v = ring.map(([lng, lat]) => toVec(lng, lat));
      for (let i = 0; i < v.length; i++) {
        pts.push(v[i]);
        if (i + 1 < v.length) {
          segs.push([v[i], v[i + 1]]);
          maxSeg = Math.max(maxSeg, angle(v[i], v[i + 1]));
        }
      }
    }
  }
  const sum: [number, number, number] = [0, 0, 0];
  for (const p of pts) {
    sum[0] += p[0];
    sum[1] += p[1];
    sum[2] += p[2];
  }
  const center = unit(sum);
  let radius = 0;
  for (const p of pts) radius = Math.max(radius, angle(p, center));
  const step = Math.max(1, Math.ceil(pts.length / COARSE_SAMPLES));
  const coarse = pts.filter((_, i) => i % step === 0);
  return { pts, segs, center, radius, maxSeg, coarse };
}

function directed(from: Shape, to: Shape, ub: number, best: number): number {
  const ptReach = to.radius + ub;
  const segReach = from.radius + ub + to.maxSeg;
  const points = from.pts.filter((p) => angle(p, to.center) <= ptReach);
  const segs = to.segs.filter(([s]) => angle(s, from.center) <= segReach);
  for (const p of points) {
    for (const [s, e] of segs) {
      const d = pointToArc(p, s, e);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Minimum great-circle distance between the boundaries of two shapes, in km. */
export function minDistanceKm(a: Shape, b: Shape): number {
  let ub = Infinity;
  for (const p of a.coarse) {
    for (const q of b.coarse) {
      const d = angle(p, q);
      if (d < ub) ub = d;
    }
  }
  let best = directed(a, b, ub, ub);
  best = directed(b, a, ub, best);
  return best * EARTH_RADIUS_KM;
}
