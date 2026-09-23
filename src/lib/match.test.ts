import { describe, expect, test } from "vitest";
import { damerauLevenshtein, excludedMessage, matchCountry } from "./match";

const names = (r: ReturnType<typeof matchCountry>) => (r.kind === "suggest" ? r.countries.map((c) => c.name) : []);

describe("damerauLevenshtein", () => {
  test("counts a transposition as one edit", () => {
    expect(damerauLevenshtein("kyrgzystan", "kyrgyzstan")).toBe(1);
  });
  test("insertions, deletions, substitutions", () => {
    expect(damerauLevenshtein("", "abc")).toBe(3);
    expect(damerauLevenshtein("grenda", "grenada")).toBe(1);
    expect(damerauLevenshtein("phillipines", "philippines")).toBe(2);
  });
});

describe("matchCountry", () => {
  test.each([
    ["France", "France"],
    ["USA", "United States"],
    ["uk", "United Kingdom"],
    ["Ivory Coast", "Côte d'Ivoire"],
    ["cote divoire", "Côte d'Ivoire"],
    ["Burma", "Myanmar"],
    ["st. lucia", "Saint Lucia"],
    ["Saint Lucia", "Saint Lucia"],
    ["the netherlands", "Netherlands"],
    ["Congo", "Republic of the Congo"],
    ["DRC", "DR Congo"],
    ["Turkey", "Türkiye"],
    ["Guinea", "Guinea"],
    ["Niger", "Niger"],
    ["Bosnia & Herzegovina", "Bosnia and Herzegovina"],
  ])("exact: %s → %s", (input, expected) => {
    const r = matchCountry(input);
    expect(r.kind).toBe("exact");
    if (r.kind === "exact") expect(r.country.name).toBe(expected);
  });

  test.each([
    ["Kyrgzystan", "Kyrgyzstan"],
    ["Phillipines", "Philippines"],
    ["Argentinia", "Argentina"],
    ["Grenda", "Grenada"],
    ["Swizerland", "Switzerland"],
    ["Columbia", "Colombia"],
    ["Azerb", "Azerbaijan"],
  ])("suggest: %s → %s first", (input, expected) => {
    const r = matchCountry(input);
    expect(r.kind).toBe("suggest");
    expect(names(r)[0]).toBe(expected);
  });

  test("ties are broken by shorter name", () => {
    expect(names(matchCountry("Nigera"))).toEqual(["Niger", "Nigeria"]);
  });

  test("returns at most 3 suggestions and includes both plausible targets", () => {
    const n = names(matchCountry("Austrlia"));
    expect(n.length).toBeLessThanOrEqual(3);
    expect(n).toContain("Australia");
    expect(n).toContain("Austria");
  });

  test("excluded territory", () => {
    const r = matchCountry("greenland");
    expect(r.kind).toBe("excluded");
    if (r.kind === "excluded") {
      expect(excludedMessage(r.entry)).toBe("Greenland isn't a country in this game — it's a territory of Denmark.");
    }
  });

  test("gibberish and blank give none", () => {
    expect(matchCountry("xqzv").kind).toBe("none");
    expect(matchCountry("   ").kind).toBe("none");
  });
});
