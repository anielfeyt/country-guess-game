import { describe, expect, test } from "vitest";
import { COUNTRY_BY_ISO } from "@/src/data/countries";
import { DIFFICULTIES, difficultyOf } from "./difficulty";
import { createGame, gameReducer, pickSecret, sortedGuesses, type GameState } from "./reducer";

/** Deterministic rand that returns the given values in order. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("pickSecret", () => {
  test("picks from the chosen difficulty's pool", () => {
    expect(pickSecret(seq(0), null, "easy")).toBe("af");
    expect(pickSecret(seq(0), null, "moderate")).toBe("at");
    expect(pickSecret(seq(0), null, "hard")).toBe("al");
  });
  test("never repeats the previous secret", () => {
    expect(pickSecret(seq(0), "af", "easy")).toBe("dz");
  });
  test("only ever returns countries of the chosen difficulty", () => {
    let x = 0.123;
    const rand = () => (x = (x * 9301 + 49297) % 233280) / 233280;
    for (const { value } of DIFFICULTIES) {
      for (let i = 0; i < 500; i++) {
        const secret = COUNTRY_BY_ISO.get(pickSecret(rand, null, value))!;
        expect(difficultyOf(secret), secret.name).toBe(value);
      }
    }
  });
});

describe("gameReducer", () => {
  const start = (): GameState => createGame("fr");

  test("createGame flags tiny secrets as difficult", () => {
    expect(createGame("fr").difficult).toBe(false);
    expect(createGame("gd").difficult).toBe(true);
  });

  test("a guess is recorded and focused", () => {
    const s = gameReducer(start(), { type: "GUESS", iso2: "es", km: 0 });
    expect(s.guesses).toEqual([{ iso2: "es", km: 0, order: 1 }]);
    expect(s.status).toBe("playing");
    expect(s.focus).toEqual({ iso2: "es", seq: 1, repeat: false });
  });

  test("a repeated guess is not added but refocuses", () => {
    let s = gameReducer(start(), { type: "GUESS", iso2: "es", km: 0 });
    s = gameReducer(s, { type: "GUESS", iso2: "es", km: 0 });
    expect(s.guesses).toHaveLength(1);
    expect(s.focus).toEqual({ iso2: "es", seq: 2, repeat: true });
  });

  test("guessing the secret wins and later guesses are ignored", () => {
    const s = gameReducer(start(), { type: "GUESS", iso2: "fr", km: 0 });
    expect(s.status).toBe("won");
    const after = gameReducer(s, { type: "GUESS", iso2: "de", km: 0 });
    expect(after).toBe(s);
  });

  test("give up reveals the secret", () => {
    const s = gameReducer(start(), { type: "GIVE_UP" });
    expect(s.status).toBe("gaveUp");
    expect(s.focus?.iso2).toBe("fr");
  });

  test("new game resets, applies its difficulty and keeps the overlay setting", () => {
    let s = gameReducer(start(), { type: "TOGGLE_OVERLAY" });
    s = gameReducer(s, { type: "GUESS", iso2: "es", km: 0 });
    s = gameReducer(s, { type: "NEW_GAME", secret: "gd", difficulty: "hard" });
    expect(s).toEqual({
      secret: "gd",
      difficulty: "hard",
      difficult: true,
      guesses: [],
      status: "playing",
      overlayOn: true,
      focus: null,
    });
  });
});

test("sortedGuesses orders by distance, unknown last, ties by order", () => {
  const sorted = sortedGuesses([
    { iso2: "a", km: 500, order: 1 },
    { iso2: "b", km: null, order: 2 },
    { iso2: "c", km: 0, order: 3 },
    { iso2: "d", km: 500, order: 4 },
  ]);
  expect(sorted.map((g) => g.iso2)).toEqual(["c", "a", "d", "b"]);
});
