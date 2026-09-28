import { DIFFICULTIES, type Difficulty } from "@/src/game/difficulty";

interface GameControlsProps {
  overlayOn: boolean;
  canGiveUp: boolean;
  onToggleOverlay: () => void;
  onGiveUp: () => void;
  onNewGame: () => void;
  difficulty: Difficulty;
  onChangeDifficulty: (difficulty: Difficulty) => void;
}

const button =
  "rounded-lg border px-3 py-1.5 text-sm font-medium leading-tight disabled:cursor-not-allowed disabled:opacity-40";
const idle = "border-white/15 bg-slate-900/80 hover:bg-slate-800";
const active = "border-sky-400 bg-sky-500/25 text-sky-100 hover:bg-sky-500/35";

export default function GameControls({
  overlayOn,
  canGiveUp,
  onToggleOverlay,
  onGiveUp,
  onNewGame,
  difficulty,
  onChangeDifficulty,
}: GameControlsProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-white/10 p-3">
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-pressed={overlayOn}
          onClick={onToggleOverlay}
          className={`${button} min-w-0 flex-1 ${overlayOn ? active : idle}`}
        >
          Names & borders
        </button>
        <button type="button" onClick={onGiveUp} disabled={!canGiveUp} className={`${button} ${idle} shrink-0 whitespace-nowrap`}>
          Give up
        </button>
        <button type="button" onClick={onNewGame} className={`${button} ${idle} shrink-0 whitespace-nowrap`}>
          New game
        </button>
      </div>
      <div role="group" aria-label="Difficulty" className="flex items-center gap-2">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Difficulty</span>
        <div className="flex min-w-0 flex-1 gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              type="button"
              aria-pressed={difficulty === d.value}
              title={d.description}
              onClick={() => onChangeDifficulty(d.value)}
              className={`${button} min-w-0 flex-1 ${difficulty === d.value ? active : idle}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
