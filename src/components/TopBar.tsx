interface TopBarProps {
  guessCount: number;
  overlayOn: boolean;
  canGiveUp: boolean;
  onToggleOverlay: () => void;
  onGiveUp: () => void;
  onNewGame: () => void;
}

const button =
  "rounded-lg border border-white/15 bg-slate-900/80 px-3 py-1.5 text-sm font-medium backdrop-blur hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40";

export default function TopBar({ guessCount, overlayOn, canGiveUp, onToggleOverlay, onGiveUp, onNewGame }: TopBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-auto rounded-lg bg-slate-900/80 px-3 py-1.5 text-sm tabular-nums backdrop-blur">
        Guesses: <b>{guessCount}</b>
      </span>
      <button
        type="button"
        aria-pressed={overlayOn}
        onClick={onToggleOverlay}
        className={`${button} ${overlayOn ? "border-sky-400 bg-sky-500/25 text-sky-100" : ""}`}
      >
        {overlayOn ? "Hide names & borders" : "Show names & borders"}
      </button>
      <button type="button" onClick={onGiveUp} disabled={!canGiveUp} className={button}>
        Give up
      </button>
      <button type="button" onClick={onNewGame} className={button}>
        New game
      </button>
    </div>
  );
}
