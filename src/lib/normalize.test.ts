import { describe, expect, test } from "vitest";
import { normalize } from "./normalize";

describe("normalize", () => {
  test.each([
    ["France", "france"],
    ["  Côte d'Ivoire ", "cote divoire"],
    ["cote divoire", "cote divoire"],
    ["São Tomé and Príncipe", "sao tome and principe"],
    ["Bosnia & Herzegovina", "bosnia and herzegovina"],
    ["Guinea-Bissau", "guinea bissau"],
    ["The Netherlands", "netherlands"],
    ["St. Lucia", "saint lucia"],
    ["st lucia", "saint lucia"],
    ["East Timor", "east timor"],
    ["Türkiye", "turkiye"],
    ["   ", ""],
  ])("%s → %s", (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});
