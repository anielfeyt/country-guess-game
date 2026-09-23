import { COUNTRY_BY_ISO } from "@/src/data/countries";
import { sortedGuesses, type Guess } from "@/src/game/reducer";
import { formatClue } from "@/src/lib/format";
import { heatColor, WIN_COLOR } from "@/src/lib/heat";

interface GuessListProps {
  guesses: Guess[];
  secret: string;
}

export default function GuessList({ guesses, secret }: GuessListProps) {
  const latest = guesses.length;
  return (
    <section className="flex h-full flex-col">
      <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
        Your guesses
      </h2>
      {guesses.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400">Type a country and press Enter.</p>
      ) : (
        <ol className="flex-1 overflow-y-auto">
          {sortedGuesses(guesses).map((g) => {
            const country = COUNTRY_BY_ISO.get(g.iso2);
            const isSecret = g.iso2 === secret;
            return (
              <li
                key={g.iso2}
                className={`flex items-center gap-3 border-b border-white/5 px-4 py-2.5 ${
                  g.order === latest ? "animate-flash" : ""
                }`}
              >
                <span className={`fi fi-${g.iso2} shrink-0 rounded-sm text-xl shadow`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{country?.name ?? g.iso2}</span>
                  <span className="block text-xs text-slate-400">{isSecret ? "🎯 Found it!" : formatClue(g.km)}</span>
                </span>
                <span
                  className="h-4 w-4 shrink-0 rounded-full ring-1 ring-white/20"
                  style={{ backgroundColor: isSecret ? WIN_COLOR : heatColor(g.km) }}
                  aria-hidden
                />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
