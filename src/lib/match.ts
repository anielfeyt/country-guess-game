import { COUNTRIES, type Country } from "@/src/data/countries";
import { EXCLUDED, type ExcludedEntry } from "@/src/data/excluded";
import { normalize } from "./normalize";

export type MatchResult =
  | { kind: "exact"; country: Country }
  | { kind: "excluded"; entry: ExcludedEntry }
  | { kind: "suggest"; countries: Country[] }
  | { kind: "none" };

const MAX_SUGGESTIONS = 3;
const MIN_PREFIX = 4;

const COUNTRY_KEYS = COUNTRIES.flatMap((country) =>
  [country.name, ...country.aliases].map((n) => ({ key: normalize(n), country })),
);
const EXCLUDED_KEYS = new Map(EXCLUDED.flatMap((e) => [e.name, ...e.aliases].map((n) => [normalize(n), e] as const)));

/** Optimal-string-alignment distance: insert, delete, substitute, swap adjacent = 1 each. */
export function damerauLevenshtein(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = new Array<number>(b.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

export function matchCountry(input: string): MatchResult {
  const q = normalize(input);
  if (!q) return { kind: "none" };

  const exact = COUNTRY_KEYS.find((e) => e.key === q);
  if (exact) return { kind: "exact", country: exact.country };

  const excluded = EXCLUDED_KEYS.get(q);
  if (excluded) return { kind: "excluded", entry: excluded };

  const best = new Map<Country, number>();
  for (const { key, country } of COUNTRY_KEYS) {
    const isPrefix = q.length >= MIN_PREFIX && key.startsWith(q);
    const dist = damerauLevenshtein(q, key);
    if (!isPrefix && dist > Math.max(1, Math.floor(key.length / 4))) continue;
    const score = isPrefix ? Math.min(dist, 0.5) : dist;
    const prev = best.get(country);
    if (prev === undefined || score < prev) best.set(country, score);
  }

  const countries = [...best.entries()]
    .sort(([a, sa], [b, sb]) => sa - sb || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, MAX_SUGGESTIONS)
    .map(([c]) => c);
  return countries.length > 0 ? { kind: "suggest", countries } : { kind: "none" };
}

export function excludedMessage(entry: ExcludedEntry): string {
  return `${entry.name} isn't a country in this game — it's ${entry.reason}.`;
}
