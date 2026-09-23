"use client";

import dynamic from "next/dynamic";

// three.js needs window/WebGL and the secret is random, so the game renders on the client only.
const Game = dynamic(() => import("./Game"), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center bg-space text-slate-400">Loading globe…</div>,
});

export default function GameLoader() {
  return <Game />;
}
