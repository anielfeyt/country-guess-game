import { describe, expect, test } from "vitest";
import { createDistanceLookup, triangleIndex } from "./distance";

describe("triangleIndex", () => {
  test("enumerates the upper triangle row by row", () => {
    const n = 4;
    const seen: number[] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) seen.push(triangleIndex(i, j, n));
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("createDistanceLookup", () => {
  // a-b 10, a-c 20, b-c 30
  const lookup = createDistanceLookup({ ids: ["a", "b", "c"], km: [10, 20, 30] });

  test("is symmetric", () => {
    expect(lookup("a", "b")).toBe(10);
    expect(lookup("b", "a")).toBe(10);
    expect(lookup("c", "a")).toBe(20);
    expect(lookup("b", "c")).toBe(30);
  });
  test("same country is 0", () => {
    expect(lookup("b", "b")).toBe(0);
  });
  test("unknown id is null", () => {
    expect(lookup("a", "zz")).toBeNull();
  });
});
