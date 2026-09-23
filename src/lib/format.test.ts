import { expect, test } from "vitest";
import { formatClue } from "./format";

test("formatClue", () => {
  expect(formatClue(0)).toBe("Shares a border!");
  expect(formatClue(37)).toBe("Closest border: 37 km");
  expect(formatClue(1240)).toBe("Closest border: 1,240 km");
  expect(formatClue(null)).toBe("Distance unknown");
});
