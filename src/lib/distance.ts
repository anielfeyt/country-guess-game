import type { DistanceTable } from "./types";

export type DistanceLookup = (a: string, b: string) => number | null;

/** Position of pair (i, j), i < j, in a row-major upper-triangle array of an n×n matrix. */
export function triangleIndex(i: number, j: number, n: number): number {
  return i * n - (i * (i + 1)) / 2 + (j - i - 1);
}

export function createDistanceLookup(table: DistanceTable): DistanceLookup {
  const n = table.ids.length;
  const pos = new Map(table.ids.map((id, i) => [id, i]));
  return (a, b) => {
    const i = pos.get(a);
    const j = pos.get(b);
    if (i === undefined || j === undefined) return null;
    if (i === j) return 0;
    const km = table.km[i < j ? triangleIndex(i, j, n) : triangleIndex(j, i, n)];
    return km ?? null;
  };
}
