import { expect, test } from "vitest";
import { labelMaxAltitude, ringAlpha } from "./zoom";

test("ringAlpha fades out between altitude 0.2 and 0.1", () => {
  expect(ringAlpha(2)).toBe(1);
  expect(ringAlpha(0.2)).toBe(1);
  expect(ringAlpha(0.15)).toBeCloseTo(0.5);
  expect(ringAlpha(0.1)).toBe(0);
  expect(ringAlpha(0.03)).toBe(0);
});

test("labelMaxAltitude shows big countries from further away", () => {
  expect(labelMaxAltitude(17_000_000)).toBe(Infinity);
  expect(labelMaxAltitude(500_000)).toBe(2.2);
  expect(labelMaxAltitude(50_000)).toBe(1.2);
  expect(labelMaxAltitude(5_000)).toBe(0.6);
  expect(labelMaxAltitude(300)).toBe(0.3);
});
