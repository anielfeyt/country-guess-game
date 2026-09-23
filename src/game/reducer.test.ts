import { describe, expect, test } from "vitest";
import { COUNTRIES } from "@/src/data/countries";
import { createGame, gameReducer, pickSecret, sortedGuesses, TINY_ROUND_P, type GameState } from "./reducer";

/** Deterministic rand that returns the given values in order. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const firstTiny = COUNTRIES.find((c) => c.tiny)!.iso2; // "ad"
const firstRegular = COUNTRIES.find((c) => !c.tiny)!.iso2; // "af"
const secondRegular = COUNTRIES.filter((c) => !c.tiny)[1].iso2; // "al"

describe("pickSecret", () => {
  test("uses the tiny pool when rand < TINY_ROUND_P", () => {
    expect(pickSecret(seq(TINY_ROUND_P - 0.01, 0), null)).toBe(firstTiny);
  });
  test("uses the regular pool otherwise", () => {
    expect(pickSecret(seq(0.5, 0), null)).toBe(firstRegular);
  });
  test("never repeats the previous secret", () => {
    expect(pickSecret(seq(0.5, 0), firstRegular)).toBe(secondRegular);
  });
  test("difficult rounds happen roughly 1 in 10 times", () => {
    let tiny = 0;
    let x = 0.123;
    const rand = () => (x = (x * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 5000; i++) if (createGame(pickSecret(rand, null)).difficult) tiny++;
    expect(tiny / 5000).toBeGreaterThan(0.07);
    expect(tiny / 5000).toBeLessThan(0.13);
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

  test("new game resets but keeps the overlay setting", () => {
    let s = gameReducer(start(), { type: "TOGGLE_OVERLAY" });
    s = gameReducer(s, { type: "GUESS", iso2: "es", km: 0 });
    s = gameReducer(s, { type: "NEW_GAME", secret: "gd" });
    expect(s).toEqual({ secret: "gd", difficult: true, guesses: [], status: "playing", overlayOn: true, focus: null });
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
