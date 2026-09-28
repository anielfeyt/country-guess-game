import { COUNTRIES, COUNTRY_BY_ISO, type Country } from "@/src/data/countries";
import { DEFAULT_DIFFICULTY, difficultyOf, type Difficulty } from "./difficulty";

export type Status = "playing" | "won" | "gaveUp";

export interface Guess {
  iso2: string;
  km: number | null;
  order: number;
}

/** Where the camera should fly. `seq` changes on every request so repeats still trigger. */
export interface Focus {
  iso2: string;
  seq: number;
  repeat: boolean;
}

export interface GameState {
  secret: string;
  difficulty: Difficulty;
  /** The secret is a tiny country (land < 1,000 km²). */
  difficult: boolean;
  guesses: Guess[];
  status: Status;
  overlayOn: boolean;
  focus: Focus | null;
}

export type GameAction =
  | { type: "GUESS"; iso2: string; km: number | null }
  | { type: "GIVE_UP" }
  | { type: "NEW_GAME"; secret: string; difficulty: Difficulty }
  | { type: "TOGGLE_OVERLAY" };

export function pickSecret(
  rand: () => number,
  previous: string | null,
  difficulty: Difficulty,
  countries: Country[] = COUNTRIES,
): string {
  const pool = countries.filter((c) => difficultyOf(c) === difficulty && c.iso2 !== previous);
  return pool[Math.floor(rand() * pool.length)].iso2;
}

export function createGame(secret: string, difficulty: Difficulty = DEFAULT_DIFFICULTY, overlayOn = false): GameState {
  return {
    secret,
    difficulty,
    difficult: COUNTRY_BY_ISO.get(secret)?.tiny === true,
    guesses: [],
    status: "playing",
    overlayOn,
    focus: null,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const nextSeq = (state.focus?.seq ?? 0) + 1;
  switch (action.type) {
    case "GUESS": {
      if (state.status !== "playing") return state;
      if (state.guesses.some((g) => g.iso2 === action.iso2)) {
        return { ...state, focus: { iso2: action.iso2, seq: nextSeq, repeat: true } };
      }
      const guess: Guess = { iso2: action.iso2, km: action.km, order: state.guesses.length + 1 };
      return {
        ...state,
        guesses: [...state.guesses, guess],
        status: action.iso2 === state.secret ? "won" : "playing",
        focus: { iso2: action.iso2, seq: nextSeq, repeat: false },
      };
    }
    case "GIVE_UP":
      if (state.status !== "playing") return state;
      return { ...state, status: "gaveUp", focus: { iso2: state.secret, seq: nextSeq, repeat: false } };
    case "NEW_GAME":
      return createGame(action.secret, action.difficulty, state.overlayOn);
    case "TOGGLE_OVERLAY":
      return { ...state, overlayOn: !state.overlayOn };
  }
}

export function sortedGuesses(guesses: Guess[]): Guess[] {
  const key = (g: Guess) => g.km ?? Number.POSITIVE_INFINITY;
  return [...guesses].sort((a, b) => key(a) - key(b) || a.order - b.order);
}
