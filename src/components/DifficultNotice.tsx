"use client";

import { useState } from "react";

export default function DifficultNotice() {
  const [expanded, setExpanded] = useState(true);
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="rounded-full border border-amber-400/50 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200 backdrop-blur"
      >
        ⚠️ Difficult round
      </button>
    );
  }
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-lg border border-amber-400/50 bg-amber-500/15 px-3 py-2 text-sm text-amber-100 backdrop-blur"
    >
      <span>⚠️ Difficult round: the secret country is very small.</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setExpanded(false)}
        className="ml-auto text-lg leading-none text-amber-200 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
