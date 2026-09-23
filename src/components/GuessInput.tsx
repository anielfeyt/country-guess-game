"use client";

import { useEffect, useRef, useState } from "react";
import type { Country } from "@/src/data/countries";
import { excludedMessage, matchCountry, type MatchResult } from "@/src/lib/match";
import { normalize } from "@/src/lib/normalize";

interface GuessInputProps {
  onGuess: (country: Country) => void;
  externalMessage: string | null;
  disabled: boolean;
}

export default function GuessInput({ onGuess, externalMessage, disabled }: GuessInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [resultFor, setResultFor] = useState({ key: "", text: "" });
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  function accept(country: Country) {
    onGuess(country);
    setValue("");
    setResult(null);
    setResultFor({ key: "", text: "" });
    inputRef.current?.focus();
  }

  function submit() {
    const key = normalize(value);
    if (!key) return;
    if (result?.kind === "suggest" && key === resultFor.key) {
      accept(result.countries[0]);
      return;
    }
    const match = matchCountry(value);
    if (match.kind === "exact") {
      accept(match.country);
      return;
    }
    setResult(match);
    setResultFor({ key, text: value.trim() });
    setShaking(true);
  }

  return (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onAnimationEnd={() => setShaking(false)}
        disabled={disabled}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        aria-label="Guess a country"
        placeholder={disabled ? "Round over — start a new game" : "Type a country and press Enter"}
        name="guess"
        className={`w-full rounded-lg border border-white/15 bg-slate-900/80 px-4 py-2.5 text-base text-white shadow-lg outline-none backdrop-blur placeholder:text-slate-400 focus:border-sky-400 disabled:opacity-60 ${
          shaking ? "animate-shake" : ""
        }`}
      />
      <div className="mt-1.5 min-h-6 text-sm" aria-live="polite">
        {disabled ? null : result?.kind === "suggest" ? (
          <span className="flex flex-wrap items-center gap-1.5 text-slate-200">
            Did you mean:
            {result.countries.map((c, i) => (
              <button
                key={c.iso2}
                type="button"
                onClick={() => accept(c)}
                className={`rounded-full border px-2.5 py-0.5 ${
                  i === 0 ? "border-sky-400 bg-sky-500/20 font-semibold text-sky-100" : "border-white/20 bg-white/5"
                } hover:bg-sky-500/30`}
              >
                {c.name}
              </button>
            ))}
            <span className="text-slate-400">(Enter picks the first)</span>
          </span>
        ) : result?.kind === "excluded" ? (
          <span className="text-amber-300">{excludedMessage(result.entry)}</span>
        ) : result?.kind === "none" ? (
          <span className="text-rose-300">No country called “{resultFor.text}”. Check the spelling?</span>
        ) : externalMessage ? (
          <span className="text-sky-300">{externalMessage}</span>
        ) : null}
      </div>
    </form>
  );
}
