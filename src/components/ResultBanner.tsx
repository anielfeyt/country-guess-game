import type { Status } from "@/src/game/reducer";

interface ResultBannerProps {
  status: Status;
  guessCount: number;
  secretName: string;
  onNewGame: () => void;
}

export default function ResultBanner({ status, guessCount, secretName, onNewGame }: ResultBannerProps) {
  if (status === "playing") return null;
  const won = status === "won";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
      <div
        role="status"
        className={`pointer-events-auto flex animate-pop items-center gap-4 rounded-xl border px-5 py-3 shadow-2xl backdrop-blur ${
          won ? "border-emerald-400/60 bg-emerald-900/80" : "border-white/20 bg-slate-900/85"
        }`}
      >
        <span className="text-lg font-semibold">
          {won ? `🎉 Found it in ${guessCount} ${guessCount === 1 ? "guess" : "guesses"}!` : `It was ${secretName}.`}
        </span>
        <button
          type="button"
          onClick={onNewGame}
          autoFocus
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-200"
        >
          New game
        </button>
      </div>
    </div>
  );
}
