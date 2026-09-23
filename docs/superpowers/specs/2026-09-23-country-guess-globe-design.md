# Country Guess Globe — Design

**Date:** 2026-09-23
**Status:** Approved in brainstorming, awaiting spec review

## 1. Summary

A browser game where the player types country names to find a randomly chosen secret country on a 3D globe. Each guess is colored on the globe on a hot/cold scale based on geographic distance to the secret country: deep red for neighbors, pale for far away, green when correct. The only clue is the nearest-border distance in km. A toggleable overlay shows every country's name and border, for learning geography. Guesses are listed in a side panel with flags. Misspellings are handled with "Did you mean…" suggestions.

## 2. Decisions

| Topic | Decision |
|---|---|
| "Closeness" | Geographic: nearest-border distance (km) between the guessed country and the secret country |
| Secret selection | Random from the playable set, unlimited games via **New game** |
| Micro-states | Playable. Tiny-country secrets are weighted so about 1 in 10 rounds is a **difficult round**, announced with a warning |
| Guess limit | None; **Give up** reveals the answer |
| Names/borders overlay | Toggle at any time, including mid-game, with no penalty |
| Spelling help | Did-you-mean on Enter only (no type-ahead autocomplete) |
| Globe library | `react-globe.gl` (three.js) |
| Framework | Existing Next.js 16 + React 19 + Tailwind 4 scaffold, client-rendered game |
| Package manager | **pnpm** (replace npm lockfile) |

## 3. Architecture

- One page (`app/page.tsx`) renders a client-only `<Game />`. The globe component is loaded with `next/dynamic` and `ssr: false`, because three.js needs `window` and WebGL.
- There is no backend. All data is static and served from `public/data/` or bundled from `src/`.
- Before writing Next-specific code, read the relevant guides in `node_modules/next/dist/docs/`, as `AGENTS.md` requires. This Next version has breaking changes.

### Units

| Unit | Responsibility | Depends on |
|---|---|---|
| `scripts/build-data.ts` | One-off data pipeline that produces the geometry, metadata checks and the distance table | Natural Earth source, `topojson-client`, geometry helpers |
| `src/data/countries.ts` | Country metadata: ISO alpha-2 code, display name, aliases, playable flag | — |
| `src/data/excluded.ts` | Territories that are recognized but excluded, each with its sovereign / reason | — |
| `src/lib/normalize.ts` | Normalizes input text for matching | — |
| `src/lib/match.ts` | `matchCountry(input)`: exact, suggestions, excluded, or none | normalize, countries, excluded |
| `src/lib/distance.ts` | `distanceKm(a, b)` lookup in the precomputed table | distances.json |
| `src/lib/heat.ts` | `heatColor(km)` and the `WIN_COLOR` constant | — |
| `src/game/reducer.ts` | Game state machine | match, distance |
| `src/components/Game.tsx` | Wires the state to the UI | reducer, components |
| `src/components/GlobeView.tsx` | Globe rendering, camera fly-to, overlay, hover | react-globe.gl, geojson |
| `src/components/GuessInput.tsx` | Input, did-you-mean chips, messages | match |
| `src/components/GuessList.tsx` | Right panel with flag, name, distance, swatch | flag-icons, heat |
| `src/components/TopBar.tsx` | Counter and Overlay / Give up / New game buttons | — |
| `src/components/ResultBanner.tsx` | Win and give-up banner | — |

## 4. Data

### 4.1 Source and generated files
- **Source:** Natural Earth admin-0 countries, 1:50m, downloaded by the build script into a git-ignored cache.
- **Mixed resolution:** tiny countries (see 4.3) take their geometry from Natural Earth **1:10m**, so their real shapes are recognizable when zoomed in. All other features use 1:50m. Distances for tiny countries are also computed from the 1:10m geometry.
- **`public/data/countries.geojson`:** simplified polygons for every feature, including drawn territories, so the land looks complete. Properties are trimmed to `{ iso2, name, playable, labelLat, labelLng, area }`.
- **`public/data/distances.json`:** a nearest-border distance matrix in km, rounded to whole km, over all **playable** countries. It is stored as an ordered ISO index list plus a flat upper-triangle array.
- The generated files are committed. The build script runs only through `pnpm data:build`, not on every `pnpm build`.

### 4.2 Distance computation
- Countries sharing a land border (a shared arc in the TopoJSON topology) are **0 km**.
- For all other pairs, the distance is the minimum great-circle distance from any vertex of A to any **edge** of B, and from B's vertices to A's edges. It is calculated on 1:50m geometry, with bounding-box pruning so the build stays fast.
- Maritime-only neighbors (e.g. UK–France) come out as a small non-zero distance. That is expected.

### 4.3 Playable set and exclusions
- **Playable = guessable = possible secret.** All sovereign and commonly recognized countries (UN members plus observers, and Kosovo and Taiwan), about 197 in total, **including micro-states**.
- **Tiny countries:** those with land area **< 1,000 km²**, about 25 of them (e.g. Vatican City, Monaco, San Marino, Liechtenstein, Andorra, Malta, Singapore, Bahrain, Maldives, St Lucia, Grenada, Barbados, Tuvalu, Nauru, Palau). Each is flagged `tiny: true` in `src/data/countries.ts`.
  - Each tiny country has a representative point (`markerLat`, `markerLng`).
  - Since tiny countries use 1:10m data, every one of them is expected to have a polygon. If one is still missing, it exists only as a point. Its distances are computed from that point: point-to-edge against polygons, point-to-point against other point-only countries.
- **Excluded (territories only):** dependent territories and disputed areas that may be drawn as land but aren't countries in this game, e.g. Greenland (Denmark), Western Sahara, Puerto Rico (USA), Falkland Islands (UK), New Caledonia (France).
  - Typing one is recognized and doesn't count as a guess. The player sees "*X* is a territory of *Y*, not a country in this game."
  - Drawn territories are colored as ordinary land and are never colored by guesses.
- **`docs/excluded-countries.md`** lists every excluded entry with its reason. `src/data/excluded.ts` is the source of truth, and a unit test checks that the doc lists exactly the same entries.

### 4.4 Names and aliases
- Every country has a display name plus aliases, e.g. "United States": `USA`, `US`, `America`, `United States of America`; "United Kingdom": `UK`, `Britain`, `Great Britain`; "Côte d'Ivoire": `Ivory Coast`; "Czechia": `Czech Republic`; "Myanmar": `Burma`; "Eswatini": `Swaziland`; "North Macedonia": `Macedonia`; "Türkiye": `Turkey`; "DR Congo": `Democratic Republic of the Congo`, `DRC`, `Congo-Kinshasa`; "Republic of the Congo": `Congo`, `Congo-Brazzaville`.
- **Flags:** the `flag-icons` package, rendered with CSS classes `fi fi-{iso2}`. It works offline.

## 5. Game logic

### 5.1 Normalization
Lowercase → strip diacritics (NFD + remove combining marks) → `&` becomes `and` → remove punctuation → collapse whitespace → drop a leading `the `.

### 5.2 `matchCountry(input)`
Returns one of:
- `{ kind: "exact", country }`: the normalized input equals a normalized name or alias.
- `{ kind: "excluded", entry }`: the input matches an excluded territory.
- `{ kind: "suggest", countries }`: up to 3 candidates ranked by Damerau-Levenshtein distance (a transposition counts as one edit) against all names and aliases. A candidate qualifies if its distance is ≤ `max(1, floor(len/4))`, or if the input is a prefix of it at least 4 characters long. Ties are broken by shorter name, then alphabetically.
- `{ kind: "none" }`: nothing qualifies. The player sees "No country called 'xyz'".

Blank input is ignored before matching is called.

### 5.3 Heat color
- `heatColor(km)`: t = `sqrt(min(km, 8000) / 8000)`, mapped from deep red (`#b3001b`, 0 km) through orange and yellow to pale cream (`#fff3d6`, ≥ 8000 km).
- `WIN_COLOR` = green (`#1fbf5b`).
- The same color is used for the globe fill and for the swatch in the panel.

### 5.4 Game state
```ts
type Status = "playing" | "won" | "gaveUp";
interface Guess { iso2: string; km: number; order: number }
interface State { secret: string; guesses: Guess[]; status: Status; overlayOn: boolean; lastEvent: Event | null }
```
Actions:
- **`GUESS(iso2)`:**
  - Ignored unless the status is `playing`.
  - A repeated guess doesn't add a new entry. It sets `lastEvent = alreadyGuessed(iso2)`, and the UI flies the camera to that country again.
  - If `iso2 === secret`, the status becomes `won`.
- **`GIVE_UP`:** the status becomes `gaveUp`.
- **`NEW_GAME`:** picks a new random secret, different from the previous one, and clears the guesses. `overlayOn` stays as it was.
  - **Weighted pick:** first choose the pool, then pick uniformly within it. The **tiny** pool is chosen with probability `TINY_ROUND_P = 0.1`, otherwise the regular pool. So about 1 in 10 rounds is difficult, however many countries are in each pool.
  - The state carries `difficult: boolean` (= the secret is tiny).
- **`TOGGLE_OVERLAY`.**

The random source is injected so tests are deterministic.

### 5.5 Clue text
- km = 0: "Shares a border!"
- Otherwise: "Closest border: 1,240 km", formatted with `Intl.NumberFormat`.

## 6. UI

### 6.1 Layout
- Desktop: the globe fills the left of the screen and a ~320 px panel sits on the right. Below ~768 px, the panel stacks under the globe.
- Top bar, over or above the globe:
  - The guess input, with the message / did-you-mean area directly under it.
  - A "Guesses: N" counter.
  - Buttons: **Show names & borders** (toggle, pressed state visible), **Give up** (disabled unless playing), **New game**.

### 6.2 Guess panel
- Title "Your guesses".
- Each row has: the flag, the country name, the clue text and a heat swatch. The winning row has a green swatch.
- Rows are sorted by km ascending, with ties broken by guess order.
- The newest row is highlighted for about 1.5 s.
- Empty state: "Type a country and press Enter."

### 6.3 Globe
- **Default look:** a dark ocean sphere with a subtle atmosphere. Unguessed countries are drawn in one neutral land color with **no visible internal borders**: the stroke is the same color as the land, or transparent. No labels.
- **Guessed countries:** filled with `heatColor(km)`, raised slightly (`polygonAltitude` ≈ 0.01 vs 0.005), with a thin darker stroke.
- **Fly-to:** when a guess is submitted (new or repeat), `pointOfView({ lat: labelLat, lng: labelLng, altitude: 2 }, 1200)`. A new guess made mid-flight replaces the current flight.
- **Win:** the country turns `WIN_COLOR`, a brief pulse/confetti plays, and the banner reads "Found it in N guesses!" with a **New game** button.
- **Give up:** fly to the secret, fill it with `WIN_COLOR` plus an outline, and show the banner "It was *Name*." with **New game**.
- **Overlay on:**
  - Every country gets a visible border stroke.
  - Name labels are placed at the label points. Label size scales with log(area).
  - Labels of smaller countries are hidden until the camera altitude drops below a threshold, so the zoomed-out view isn't cluttered.
  - Guessed colors stay visible under the overlay.
- **Interaction:** drag to rotate, scroll or pinch to zoom.
  - **Deep zoom:** zoom is allowed from the full-globe view down to camera altitude ≈ 0.025 (≈ 150 km above the surface), so micro-states can be inspected. Rotation speed scales with altitude so it stays controllable up close.
  - Fly-to altitude is 2 for regular countries and 0.4 for tiny ones. Hovering a *guessed* country shows its name in a tooltip. With the overlay on, hovering any country shows its name.
- Slow auto-rotate while idle before the first guess; it stops on the first interaction.
- **Tiny-country markers** (a `ringsData` / points layer), because tiny countries are sub-pixel at globe scale:
  - A guessed tiny country gets a ring in its heat color, or `WIN_COLOR` on a win, at its marker point. The ring stays visible when zoomed out, then fades out below altitude ≈ 0.15, where the detailed polygon itself is clearly visible and colored.
  - With the overlay on, every tiny country gets a small neutral ring plus a name label.
  - Give-up on a tiny secret shows a green ring at the secret.

### 6.3.1 Difficult-round warning
When `difficult` is true, a dismissible amber notice appears under the top bar at the start of the round: "⚠️ Difficult round: the secret country is very small." It stays visible (collapsed to a small "Difficult round" badge) for the rest of the round.

### 6.4 Did-you-mean
- On a `suggest` result, the input shakes briefly and chips appear: "Did you mean: **Kyrgyzstan** · Kazakhstan?"
- Pressing Enter again with the input unchanged accepts the first chip. Clicking a chip accepts that one.
- Accepting a chip submits it as a guess and clears the input.
- `excluded` and `none` results show their message in the same area. After every submitted guess the input is cleared and keeps focus.

## 7. Error handling
- **No WebGL:** detected before mounting the globe. Show a message saying the game needs WebGL, with browser hints.
- **Data fetch failure** (geojson or distances): show an error card with a **Retry** button.
- Missing distance entry for a pair (which should never happen, and the data tests guard against it): log it and treat the distance as unknown. The row shows "distance unknown" and a neutral color. The app must not crash.

## 8. Testing
- **Vitest** unit tests:
  - `normalize`: accents, punctuation, `&`, leading "the".
  - `matchCountry`: exact names, aliases (USA, UK, Ivory Coast, Burma, St Lucia / Saint Lucia), accents ("cote divoire"), typos ("Kyrgzystan" → Kyrgyzstan, "Phillipines" → Philippines, "Argentinia" → Argentina, "Grenda" → Grenada), excluded territory ("Greenland"), gibberish → none.
  - `heatColor`: 0 km, 8000 km, clamping above 8000 km, monotonic lightness.
  - Reducer: a guess adds an entry; a repeat guess doesn't add one; a correct guess wins; guesses after a win are ignored; give up; a new game resets and picks a different secret; the overlay toggle survives a new game; with a seeded random source, the tiny pool is chosen when rand < 0.1 and sets `difficult`.
  - Data checks: France–Spain = 0; Germany–Poland = 0; UK–France small (< 100 km); Australia–Brazil large (> 10,000 km); the matrix is symmetric with a zero diagonal; every playable country has geometry or a marker point (tiny countries must have a marker), a flag class, a distance row and a unique name; Grenada–St Vincent is small (< 200 km); every alias resolves to exactly one country; `docs/excluded-countries.md` matches `src/data/excluded.ts`.
- **Manual browser check** via Chrome DevTools MCP: play a full round covering a typo, did-you-mean, several guesses, a tiny-country guess (ring visible, then zoom in until the ring fades and the colored Grenada/Malta shape is visible), a forced difficult round (warning visible), the overlay toggle, the win banner, give-up and a new game. Take screenshots and check the console for errors.

## 9. Tooling
- pnpm: remove `package-lock.json`, add `"packageManager": "pnpm@10.x"` to `package.json`, and run `pnpm install`.
- Scripts: `dev`, `build`, `start`, `lint`, `test` (vitest), `data:build` (tsx scripts/build-data.ts).
- New dependencies: `react-globe.gl`, `three`, `flag-icons`. Dev dependencies: `vitest`, `tsx`, `topojson-client` and `topojson-server` (for shared-arc neighbor detection), plus their types.

## 10. Out of scope
Daily puzzle, stats/streaks, additional clue types (direction, population, etc.), sound, localization, accounts, deployment setup.
