"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { COUNTRY_BY_ISO, type Country } from "@/src/data/countries";
import { DEFAULT_DIFFICULTY, difficultyOf, isDifficulty, type Difficulty } from "@/src/game/difficulty";
import { createGame, gameReducer, pickSecret, type GameState } from "@/src/game/reducer";
import { heatColor, WIN_COLOR } from "@/src/lib/heat";
import { loadGameData, type GameData } from "@/src/lib/loadData";
import { hasWebGL } from "@/src/lib/webgl";
import DifficultNotice from "./DifficultNotice";
import GameControls from "./GameControls";
import GlobeView from "./GlobeView";
import GuessInput from "./GuessInput";
import GuessList from "./GuessList";
import ResultBanner from "./ResultBanner";

const DIFFICULTY_KEY = "country-guess:difficulty";

function loadDifficulty(): Difficulty {
  try {
    const stored = localStorage.getItem(DIFFICULTY_KEY);
    return isDifficulty(stored) ? stored : DEFAULT_DIFFICULTY;
  } catch {
    return DEFAULT_DIFFICULTY;
  }
}

function saveDifficulty(difficulty: Difficulty) {
  try {
    localStorage.setItem(DIFFICULTY_KEY, difficulty);
  } catch {
    // Storage unavailable (private mode, blocked site data): the choice just won't persist.
  }
}

/** In development, `?secret=gd` forces the secret country (used for manual testing). */
function initialGame(): GameState {
  if (process.env.NODE_ENV !== "production") {
    const forced = COUNTRY_BY_ISO.get(new URLSearchParams(window.location.search).get("secret")?.toLowerCase() ?? "");
    if (forced) return createGame(forced.iso2, difficultyOf(forced));
  }
  const difficulty = loadDifficulty();
  return createGame(pickSecret(Math.random, null, difficulty), difficulty);
}

export default function Game() {
  const [webgl] = useState(hasWebGL);
  const [data, setData] = useState<GameData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, dispatch] = useReducer(gameReducer, null, initialGame);

  useEffect(() => {
    if (!webgl) return;
    let cancelled = false;
    loadGameData()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, webgl]);

  const colors = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of state.guesses) map.set(g.iso2, g.iso2 === state.secret ? WIN_COLOR : heatColor(g.km));
    if (state.status === "gaveUp") map.set(state.secret, WIN_COLOR);
    return map;
  }, [state.guesses, state.secret, state.status]);

  const secretName = COUNTRY_BY_ISO.get(state.secret)?.name ?? state.secret;
  const repeatName = state.focus?.repeat ? COUNTRY_BY_ISO.get(state.focus.iso2)?.name : undefined;

  function handleGuess(country: Country) {
    const km = country.iso2 === state.secret ? 0 : (data?.distance(country.iso2, state.secret) ?? null);
    if (km === null) console.warn(`No distance for ${country.iso2} → ${state.secret}`);
    dispatch({ type: "GUESS", iso2: country.iso2, km });
  }

  function startGame(difficulty: Difficulty) {
    dispatch({ type: "NEW_GAME", secret: pickSecret(Math.random, state.secret, difficulty), difficulty });
  }

  function newGame() {
    startGame(state.difficulty);
  }

  function changeDifficulty(difficulty: Difficulty) {
    if (difficulty === state.difficulty) return;
    saveDifficulty(difficulty);
    startGame(difficulty);
  }

  if (!webgl) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">This game needs WebGL</h1>
        <p className="mt-2 text-slate-400">
          Your browser or device has WebGL turned off. Try a recent Chrome, Edge, Firefox or Safari, and make sure
          hardware acceleration is enabled.
        </p>
      </Centered>
    );
  }

  if (loadError) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Couldn’t load the map data</h1>
        <p className="mt-2 text-slate-400">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            setAttempt((a) => a + 1);
          }}
          className="mt-4 rounded-lg bg-white px-4 py-2 font-semibold text-slate-900"
        >
          Retry
        </button>
      </Centered>
    );
  }

  if (!data) return <Centered>Loading globe…</Centered>;

  return (
    <div className="flex h-dvh flex-col bg-space md:flex-row">
      <main className="relative min-h-[60vh] flex-1 overflow-hidden">
        <GlobeView
          features={data.features}
          colors={colors}
          outlined={state.status === "gaveUp" ? state.secret : null}
          overlayOn={state.overlayOn}
          focus={state.focus}
          resetKey={state.secret}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 p-3 md:p-4">
          <div className="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-2">
            <GuessInput
              key={state.secret}
              onGuess={handleGuess}
              disabled={state.status !== "playing"}
              externalMessage={repeatName ? `You already guessed ${repeatName}.` : null}
            />
            {state.difficult && (
              <div className="flex">
                <DifficultNotice key={state.secret} />
              </div>
            )}
          </div>
        </div>
        <ResultBanner
          status={state.status}
          guessCount={state.guesses.length}
          secretName={secretName}
          onNewGame={newGame}
        />
      </main>
      <aside className="flex h-[40vh] flex-col border-t border-white/10 bg-panel md:h-auto md:w-96 md:border-l md:border-t-0">
        <GameControls
          overlayOn={state.overlayOn}
          canGiveUp={state.status === "playing"}
          onToggleOverlay={() => dispatch({ type: "TOGGLE_OVERLAY" })}
          onGiveUp={() => dispatch({ type: "GIVE_UP" })}
          onNewGame={newGame}
          difficulty={state.difficulty}
          onChangeDifficulty={changeDifficulty}
        />
        <GuessList guesses={state.guesses} secret={state.secret} />
      </aside>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-dvh place-items-center bg-space p-6 text-center text-slate-300">
      <div className="max-w-md">{children}</div>
    </div>
  );
}
