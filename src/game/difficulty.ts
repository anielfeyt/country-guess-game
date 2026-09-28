import type { Country } from "@/src/data/countries";

export type Difficulty = "easy" | "moderate" | "hard";

export const DIFFICULTIES: { value: Difficulty; label: string; description: string }[] = [
  { value: "easy", label: "Easy", description: "Large countries (300,000 km² and up)" },
  { value: "moderate", label: "Moderate", description: "Mid-size countries, down to the Dominican Republic" },
  { value: "hard", label: "Hard", description: "Countries smaller than the Dominican Republic" },
];

export const DEFAULT_DIFFICULTY: Difficulty = "easy";

/** Easy rounds use countries at least this large. */
export const EASY_MIN_KM2 = 300_000;
/** The Dominican Republic's land area: anything smaller is hard. */
export const MODERATE_MIN_KM2 = 48_587;

export function difficultyOf(country: Pick<Country, "areaKm2">): Difficulty {
  if (country.areaKm2 >= EASY_MIN_KM2) return "easy";
  if (country.areaKm2 >= MODERATE_MIN_KM2) return "moderate";
  return "hard";
}

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.some((d) => d.value === value);
}
