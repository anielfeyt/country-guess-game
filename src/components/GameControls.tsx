interface GameControlsProps {
  overlayOn: boolean;
  canGiveUp: boolean;
  onToggleOverlay: () => void;
  onGiveUp: () => void;
  onNewGame: () => void;
}

const button =
  "rounded-lg border border-white/15 bg-slate-900/80 px-3 py-1.5 text-sm font-medium leading-tight hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40";

export default function GameControls({ overlayOn, canGiveUp, onToggleOverlay, onGiveUp, onNewGame }: GameControlsProps) {
  return (
    <div className="flex items-stretch gap-2 border-b border-white/10 p-3">
      <button
        type="button"
        aria-pressed={overlayOn}
        onClick={onToggleOverlay}
        className={`${button} min-w-0 flex-1 ${overlayOn ? "border-sky-400 bg-sky-500/25 text-sky-100" : ""}`}
      >
        Names & borders
      </button>
      <button type="button" onClick={onGiveUp} disabled={!canGiveUp} className={`${button} shrink-0 whitespace-nowrap`}>
        Give up
      </button>
      <button type="button" onClick={onNewGame} className={`${button} shrink-0 whitespace-nowrap`}>
        New game
      </button>
    </div>
  );
}
