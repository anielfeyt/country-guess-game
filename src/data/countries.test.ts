import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { COUNTRIES, COUNTRY_BY_ISO } from "./countries";
import { EXCLUDED } from "./excluded";
import { normalize } from "@/src/lib/normalize";

describe("COUNTRIES", () => {
  test("has 197 countries, 25 of them tiny", () => {
    expect(COUNTRIES).toHaveLength(197);
    expect(COUNTRIES.filter((c) => c.tiny)).toHaveLength(25);
  });

  test("iso2 and a3 codes are unique", () => {
    expect(new Set(COUNTRIES.map((c) => c.iso2)).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((c) => c.a3)).size).toBe(COUNTRIES.length);
    expect(COUNTRY_BY_ISO.size).toBe(COUNTRIES.length);
  });

  test("every name and alias normalises to a key owned by exactly one place", () => {
    const owner = new Map<string, string>();
    const claim = (key: string, who: string) => {
      const prev = owner.get(key);
      expect(prev === undefined || prev === who, `"${key}" claimed by ${prev} and ${who}`).toBe(true);
      owner.set(key, who);
    };
    for (const c of COUNTRIES) for (const n of [c.name, ...c.aliases]) claim(normalize(n), c.iso2);
    for (const e of EXCLUDED) for (const n of [e.name, ...e.aliases]) claim(normalize(n), `excluded:${e.name}`);
  });

  test("every country has a flag-icons SVG", () => {
    for (const c of COUNTRIES) {
      const svg = path.join(process.cwd(), "node_modules", "flag-icons", "flags", "4x3", `${c.iso2}.svg`);
      expect(fs.existsSync(svg), `missing flag for ${c.name}`).toBe(true);
    }
  });
});

describe("docs/excluded-countries.md", () => {
  test("lists exactly the entries in EXCLUDED", () => {
    const md = fs.readFileSync(path.join(process.cwd(), "docs", "excluded-countries.md"), "utf8");
    const names = md
      .split(/\r?\n/)
      .filter((line) => line.startsWith("| ") && !line.startsWith("| Name ") && !line.startsWith("|---"))
      .map((line) => line.split("|")[1].trim());
    expect(names.sort()).toEqual(EXCLUDED.map((e) => e.name).sort());
  });
});
