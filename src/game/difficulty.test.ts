import { describe, expect, test } from "vitest";
import { COUNTRIES, COUNTRY_BY_ISO } from "@/src/data/countries";
import { difficultyOf, isDifficulty, MODERATE_MIN_KM2 } from "./difficulty";

const level = (iso2: string) => difficultyOf(COUNTRY_BY_ISO.get(iso2)!);
const count = (d: string) => COUNTRIES.filter((c) => difficultyOf(c) === d).length;

describe("difficultyOf", () => {
  test("the moderate floor is the Dominican Republic's area", () => {
    expect(COUNTRY_BY_ISO.get("do")!.areaKm2).toBe(MODERATE_MIN_KM2);
  });

  test("the Dominican Republic is moderate and anything smaller is hard", () => {
    expect(level("do")).toBe("moderate");
    expect(level("sk")).toBe("hard");
    for (const c of COUNTRIES) if (c.areaKm2 < MODERATE_MIN_KM2) expect(difficultyOf(c), c.name).toBe("hard");
  });

  test("large countries are easy", () => {
    expect(level("ru")).toBe("easy");
    expect(level("it")).toBe("easy");
    expect(level("ph")).toBe("moderate");
  });

  test("every tiny country is hard", () => {
    for (const c of COUNTRIES.filter((c) => c.tiny)) expect(difficultyOf(c), c.name).toBe("hard");
  });

  test("splits the 197 countries 71 / 56 / 70", () => {
    expect(count("easy")).toBe(71);
    expect(count("moderate")).toBe(56);
    expect(count("hard")).toBe(70);
  });
});

test("isDifficulty accepts only known levels", () => {
  expect(isDifficulty("hard")).toBe(true);
  expect(isDifficulty("extreme")).toBe(false);
  expect(isDifficulty(null)).toBe(false);
});
