# Country Guess Globe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser game where the player types country names to find a random secret country on a 3D globe. Guesses are colored hot/cold by nearest-border distance, with did-you-mean spelling help, a names-and-borders learning overlay, a flag list of guesses, and difficult rounds for micro-states.

**Architecture:** A Next.js 16 app whose only page renders a client-only (`ssr: false`) `<Game />`. The game logic is pure TypeScript modules, unit-tested with Vitest: name matching, heat colors, distance lookup and a reducer. A one-off script (`pnpm data:build`) turns Natural Earth data into `public/data/countries.geojson` plus a precomputed nearest-border `distances.json`, and both files are committed. The globe is `react-globe.gl` (three.js), with polygon, ring and HTML-label layers.

**Tech Stack:** pnpm, Next.js 16.3 (App Router), React 19.2, Tailwind 4, TypeScript 5, react-globe.gl 2.38 / three 0.186, flag-icons 7, Vitest, tsx, topojson-server/client, d3-geo.

**Spec:** `docs/superpowers/specs/2026-09-23-country-guess-globe-design.md`

## Global Constraints

- Package manager is **pnpm** only. There must be no `package-lock.json` in the repo, and `package.json` has a `"packageManager": "pnpm@10.33.2"` field.
- `AGENTS.md`: this Next.js version has breaking changes. Before writing Next-specific code, read the relevant guide in `node_modules/next/dist/docs/`. `ssr: false` with `next/dynamic` only works inside a **Client Component** (`01-app/02-guides/lazy-loading.md`).
- The import alias `@/*` maps to the repo root, so app code in `src/` is imported as `@/src/...`.
- There are no runtime network calls outside the app itself: data, flags and fonts are all local or bundled. Only `pnpm data:build` downloads anything.
- Playable countries: exactly the **197** entries in `src/data/countries.ts`, of which **25** are `tiny` (land < 1,000 km²).
- `TINY_ROUND_P = 0.1`. `MAX_KM = 8000`. `WIN_COLOR = "#1fbf5b"`. The heat ramp runs `#b3001b` (0 km) → `#e8541e` → `#f7b538` → `#fff3d6` (≥ 8000 km) on `t = sqrt(min(km, 8000) / 8000)`.
- Camera: minimum altitude `0.025` (≈ 160 km), fly-to altitude `2` (regular) or `0.4` (tiny), fly-to duration `1200` ms.
- Clue copy: `"Shares a border!"` for 0 km, otherwise `"Closest border: 1,240 km"` (en-US number format). Difficult-round copy: `"⚠️ Difficult round: the secret country is very small."`
- Commit after every task. Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## File Structure

```
app/
  layout.tsx              (modify) title, flag-icons CSS, dark body
  page.tsx                (replace) renders <GameLoader/>
  globals.css             (replace) theme tokens, keyframes, globe label styles
src/
  data/countries.ts       Country list (iso2, a3, name, aliases, tiny) + COUNTRY_BY_ISO
  data/excluded.ts        Territories recognised but not playable
  lib/normalize.ts        Input normalisation for matching
  lib/match.ts            matchCountry, damerauLevenshtein, excludedMessage
  lib/heat.ts             heatColor, hexToRgb, WIN_COLOR, UNKNOWN_COLOR, MAX_KM
  lib/format.ts           formatClue
  lib/zoom.ts             ringAlpha, labelMaxAltitude
  lib/types.ts            CountryFeatureProps, CountryFeature, DistanceTable
  lib/distance.ts         triangleIndex, createDistanceLookup
  lib/loadData.ts         loadGameData (fetch geojson + distances)
  lib/webgl.ts            hasWebGL
  game/reducer.ts         GameState, gameReducer, createGame, pickSecret, sortedGuesses
  components/GameLoader.tsx   client wrapper doing dynamic(..., { ssr: false })
  components/Game.tsx         state + data loading + layout
  components/GlobeView.tsx    react-globe.gl rendering
  components/GuessInput.tsx   input + did-you-mean
  components/TopBar.tsx       counter + buttons
  components/GuessList.tsx    right panel
  components/ResultBanner.tsx win / give-up banner
  components/DifficultNotice.tsx
  **/*.test.ts            Vitest tests next to the code
scripts/
  lib/sphere.ts           spherical geometry + min border distance
  lib/sphere.test.ts
  build-data.ts           Natural Earth → public/data/*
public/data/
  countries.geojson       generated, committed
  distances.json          generated, committed
docs/excluded-countries.md
vitest.config.mts
```

---

### Task 1: Switch to pnpm, add dependencies and Vitest

**Files:**
- Delete: `package-lock.json`, `node_modules/`
- Modify: `package.json`, `.gitignore`
- Create: `vitest.config.mts`, `src/smoke.test.ts` (deleted again in step 7)

**Interfaces:**
- Produces: `pnpm test` (Vitest, node env, includes `src/**/*.test.ts` and `scripts/**/*.test.ts`), `pnpm data:build` (`tsx scripts/build-data.ts`), and the `@` alias → repo root inside tests.

- [ ] **Step 1: Remove npm artifacts**

```bash
rm -f package-lock.json
rm -rf node_modules
```

- [ ] **Step 2: Edit `package.json`** to set the scripts and the package manager (leave the dependencies as they are, since pnpm adds the rest):

```json
{
  "name": "country-guess-game",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@10.33.2",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "data:build": "tsx scripts/build-data.ts"
  },
  "dependencies": {
    "next": "16.3.6",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 3: Install**

```bash
pnpm install
pnpm add react-globe.gl three flag-icons
pnpm add -D vitest tsx topojson-server topojson-client d3-geo @types/topojson-server @types/topojson-client @types/topojson-specification @types/d3-geo @types/three @types/geojson
```

If pnpm prints "Ignored build scripts: sharp, unrs-resolver", add this to `package.json` and run `pnpm install` again:

```json
"pnpm": { "onlyBuiltDependencies": ["sharp", "unrs-resolver"] }
```

- [ ] **Step 4: Add `.cache/` to `.gitignore`** (append at the end):

```
# data build downloads
/.cache/
```

- [ ] **Step 5: Create `vitest.config.mts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
```

- [ ] **Step 6: Smoke test.** Create `src/smoke.test.ts`:

```ts
import { expect, test } from "vitest";

test("vitest runs", () => {
  expect(1 + 1).toBe(2);
});
```

Run: `pnpm test`
Expected: `1 passed`.

- [ ] **Step 7: Delete the smoke test, check lint, commit**

```bash
rm src/smoke.test.ts
pnpm lint
git add -A
git commit -m "chore: switch to pnpm, add globe, flag and test dependencies

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Confirm `git status` shows `pnpm-lock.yaml` committed and no `package-lock.json`.

---

### Task 2: Normalisation, country data, excluded territories

**Files:**
- Create: `src/lib/normalize.ts`, `src/lib/normalize.test.ts`
- Create: `src/data/countries.ts`, `src/data/excluded.ts`, `src/data/countries.test.ts`
- Create: `docs/excluded-countries.md`

**Interfaces:**
- Produces: `normalize(input: string): string`
- Produces: `interface Country { iso2: string; a3: string; name: string; aliases: string[]; tiny?: true }`, `COUNTRIES: Country[]`, `COUNTRY_BY_ISO: Map<string, Country>`
- Produces: `interface ExcludedEntry { name: string; aliases: string[]; reason: string }`, `EXCLUDED: ExcludedEntry[]`

- [ ] **Step 1: Write the failing normalisation test** in `src/lib/normalize.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { normalize } from "./normalize";

describe("normalize", () => {
  test.each([
    ["France", "france"],
    ["  Côte d'Ivoire ", "cote divoire"],
    ["cote divoire", "cote divoire"],
    ["São Tomé and Príncipe", "sao tome and principe"],
    ["Bosnia & Herzegovina", "bosnia and herzegovina"],
    ["Guinea-Bissau", "guinea bissau"],
    ["The Netherlands", "netherlands"],
    ["St. Lucia", "saint lucia"],
    ["st lucia", "saint lucia"],
    ["East Timor", "east timor"],
    ["Türkiye", "turkiye"],
    ["   ", ""],
  ])("%s → %s", (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/lib/normalize.test.ts`
Expected: FAIL, `Cannot find module './normalize'` or similar.

- [ ] **Step 3: Implement `src/lib/normalize.ts`**

```ts
/** Canonical form used for comparing typed guesses with country names. */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/\bst\.?(?=\s)/g, "saint")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "");
}
```

- [ ] **Step 4: Run it and verify it passes**

Run: `pnpm test src/lib/normalize.test.ts`
Expected: 12 passed.

- [ ] **Step 5: Create `src/data/countries.ts`.** This list was validated on 2026-09-23 against Natural Earth `ADM0_A3` codes and the flag-icons SVGs: 197 entries, 25 tiny.

```ts
export interface Country {
  /** ISO 3166-1 alpha-2, lowercase; also the flag-icons code. Kosovo uses "xk". */
  iso2: string;
  /** Natural Earth ADM0_A3 code used to join geometry. */
  a3: string;
  name: string;
  aliases: string[];
  /** Land area < 1,000 km²: drawn with marker rings, "difficult round" when secret. */
  tiny?: true;
}

export const COUNTRIES: Country[] = [
  { iso2: "af", a3: "AFG", name: "Afghanistan", aliases: [] },
  { iso2: "al", a3: "ALB", name: "Albania", aliases: [] },
  { iso2: "dz", a3: "DZA", name: "Algeria", aliases: [] },
  { iso2: "ad", a3: "AND", name: "Andorra", aliases: [], tiny: true },
  { iso2: "ao", a3: "AGO", name: "Angola", aliases: [] },
  { iso2: "ag", a3: "ATG", name: "Antigua and Barbuda", aliases: ["Antigua"], tiny: true },
  { iso2: "ar", a3: "ARG", name: "Argentina", aliases: [] },
  { iso2: "am", a3: "ARM", name: "Armenia", aliases: [] },
  { iso2: "au", a3: "AUS", name: "Australia", aliases: [] },
  { iso2: "at", a3: "AUT", name: "Austria", aliases: [] },
  { iso2: "az", a3: "AZE", name: "Azerbaijan", aliases: [] },
  { iso2: "bs", a3: "BHS", name: "Bahamas", aliases: ["The Bahamas"] },
  { iso2: "bh", a3: "BHR", name: "Bahrain", aliases: [], tiny: true },
  { iso2: "bd", a3: "BGD", name: "Bangladesh", aliases: [] },
  { iso2: "bb", a3: "BRB", name: "Barbados", aliases: [], tiny: true },
  { iso2: "by", a3: "BLR", name: "Belarus", aliases: ["Byelorussia"] },
  { iso2: "be", a3: "BEL", name: "Belgium", aliases: [] },
  { iso2: "bz", a3: "BLZ", name: "Belize", aliases: [] },
  { iso2: "bj", a3: "BEN", name: "Benin", aliases: [] },
  { iso2: "bt", a3: "BTN", name: "Bhutan", aliases: [] },
  { iso2: "bo", a3: "BOL", name: "Bolivia", aliases: [] },
  { iso2: "ba", a3: "BIH", name: "Bosnia and Herzegovina", aliases: ["Bosnia", "Bosnia-Herzegovina"] },
  { iso2: "bw", a3: "BWA", name: "Botswana", aliases: [] },
  { iso2: "br", a3: "BRA", name: "Brazil", aliases: ["Brasil"] },
  { iso2: "bn", a3: "BRN", name: "Brunei", aliases: ["Brunei Darussalam"] },
  { iso2: "bg", a3: "BGR", name: "Bulgaria", aliases: [] },
  { iso2: "bf", a3: "BFA", name: "Burkina Faso", aliases: [] },
  { iso2: "bi", a3: "BDI", name: "Burundi", aliases: [] },
  { iso2: "cv", a3: "CPV", name: "Cabo Verde", aliases: ["Cape Verde"] },
  { iso2: "kh", a3: "KHM", name: "Cambodia", aliases: [] },
  { iso2: "cm", a3: "CMR", name: "Cameroon", aliases: [] },
  { iso2: "ca", a3: "CAN", name: "Canada", aliases: [] },
  { iso2: "cf", a3: "CAF", name: "Central African Republic", aliases: ["CAR"] },
  { iso2: "td", a3: "TCD", name: "Chad", aliases: [] },
  { iso2: "cl", a3: "CHL", name: "Chile", aliases: [] },
  { iso2: "cn", a3: "CHN", name: "China", aliases: ["PRC", "People's Republic of China"] },
  { iso2: "co", a3: "COL", name: "Colombia", aliases: [] },
  { iso2: "km", a3: "COM", name: "Comoros", aliases: [] },
  { iso2: "cg", a3: "COG", name: "Republic of the Congo", aliases: ["Congo", "Congo-Brazzaville", "Congo Republic"] },
  { iso2: "cd", a3: "COD", name: "DR Congo", aliases: ["Democratic Republic of the Congo", "DRC", "Congo-Kinshasa", "Zaire"] },
  { iso2: "cr", a3: "CRI", name: "Costa Rica", aliases: [] },
  { iso2: "ci", a3: "CIV", name: "Côte d'Ivoire", aliases: ["Ivory Coast"] },
  { iso2: "hr", a3: "HRV", name: "Croatia", aliases: [] },
  { iso2: "cu", a3: "CUB", name: "Cuba", aliases: [] },
  { iso2: "cy", a3: "CYP", name: "Cyprus", aliases: [] },
  { iso2: "cz", a3: "CZE", name: "Czechia", aliases: ["Czech Republic"] },
  { iso2: "dk", a3: "DNK", name: "Denmark", aliases: [] },
  { iso2: "dj", a3: "DJI", name: "Djibouti", aliases: [] },
  { iso2: "dm", a3: "DMA", name: "Dominica", aliases: [], tiny: true },
  { iso2: "do", a3: "DOM", name: "Dominican Republic", aliases: [] },
  { iso2: "ec", a3: "ECU", name: "Ecuador", aliases: [] },
  { iso2: "eg", a3: "EGY", name: "Egypt", aliases: [] },
  { iso2: "sv", a3: "SLV", name: "El Salvador", aliases: [] },
  { iso2: "gq", a3: "GNQ", name: "Equatorial Guinea", aliases: [] },
  { iso2: "er", a3: "ERI", name: "Eritrea", aliases: [] },
  { iso2: "ee", a3: "EST", name: "Estonia", aliases: [] },
  { iso2: "sz", a3: "SWZ", name: "Eswatini", aliases: ["Swaziland"] },
  { iso2: "et", a3: "ETH", name: "Ethiopia", aliases: [] },
  { iso2: "fj", a3: "FJI", name: "Fiji", aliases: [] },
  { iso2: "fi", a3: "FIN", name: "Finland", aliases: [] },
  { iso2: "fr", a3: "FRA", name: "France", aliases: [] },
  { iso2: "ga", a3: "GAB", name: "Gabon", aliases: [] },
  { iso2: "gm", a3: "GMB", name: "Gambia", aliases: ["The Gambia"] },
  { iso2: "ge", a3: "GEO", name: "Georgia", aliases: [] },
  { iso2: "de", a3: "DEU", name: "Germany", aliases: ["Deutschland"] },
  { iso2: "gh", a3: "GHA", name: "Ghana", aliases: [] },
  { iso2: "gr", a3: "GRC", name: "Greece", aliases: ["Hellas"] },
  { iso2: "gd", a3: "GRD", name: "Grenada", aliases: [], tiny: true },
  { iso2: "gt", a3: "GTM", name: "Guatemala", aliases: [] },
  { iso2: "gn", a3: "GIN", name: "Guinea", aliases: [] },
  { iso2: "gw", a3: "GNB", name: "Guinea-Bissau", aliases: [] },
  { iso2: "gy", a3: "GUY", name: "Guyana", aliases: [] },
  { iso2: "ht", a3: "HTI", name: "Haiti", aliases: [] },
  { iso2: "hn", a3: "HND", name: "Honduras", aliases: [] },
  { iso2: "hu", a3: "HUN", name: "Hungary", aliases: [] },
  { iso2: "is", a3: "ISL", name: "Iceland", aliases: [] },
  { iso2: "in", a3: "IND", name: "India", aliases: [] },
  { iso2: "id", a3: "IDN", name: "Indonesia", aliases: [] },
  { iso2: "ir", a3: "IRN", name: "Iran", aliases: ["Persia"] },
  { iso2: "iq", a3: "IRQ", name: "Iraq", aliases: [] },
  { iso2: "ie", a3: "IRL", name: "Ireland", aliases: ["Eire", "Republic of Ireland"] },
  { iso2: "il", a3: "ISR", name: "Israel", aliases: [] },
  { iso2: "it", a3: "ITA", name: "Italy", aliases: ["Italia"] },
  { iso2: "jm", a3: "JAM", name: "Jamaica", aliases: [] },
  { iso2: "jp", a3: "JPN", name: "Japan", aliases: [] },
  { iso2: "jo", a3: "JOR", name: "Jordan", aliases: [] },
  { iso2: "kz", a3: "KAZ", name: "Kazakhstan", aliases: [] },
  { iso2: "ke", a3: "KEN", name: "Kenya", aliases: [] },
  { iso2: "ki", a3: "KIR", name: "Kiribati", aliases: [], tiny: true },
  { iso2: "xk", a3: "KOS", name: "Kosovo", aliases: [] },
  { iso2: "kw", a3: "KWT", name: "Kuwait", aliases: [] },
  { iso2: "kg", a3: "KGZ", name: "Kyrgyzstan", aliases: ["Kirghizia"] },
  { iso2: "la", a3: "LAO", name: "Laos", aliases: ["Lao PDR"] },
  { iso2: "lv", a3: "LVA", name: "Latvia", aliases: [] },
  { iso2: "lb", a3: "LBN", name: "Lebanon", aliases: [] },
  { iso2: "ls", a3: "LSO", name: "Lesotho", aliases: [] },
  { iso2: "lr", a3: "LBR", name: "Liberia", aliases: [] },
  { iso2: "ly", a3: "LBY", name: "Libya", aliases: [] },
  { iso2: "li", a3: "LIE", name: "Liechtenstein", aliases: [], tiny: true },
  { iso2: "lt", a3: "LTU", name: "Lithuania", aliases: [] },
  { iso2: "lu", a3: "LUX", name: "Luxembourg", aliases: [] },
  { iso2: "mg", a3: "MDG", name: "Madagascar", aliases: [] },
  { iso2: "mw", a3: "MWI", name: "Malawi", aliases: [] },
  { iso2: "my", a3: "MYS", name: "Malaysia", aliases: [] },
  { iso2: "mv", a3: "MDV", name: "Maldives", aliases: [], tiny: true },
  { iso2: "ml", a3: "MLI", name: "Mali", aliases: [] },
  { iso2: "mt", a3: "MLT", name: "Malta", aliases: [], tiny: true },
  { iso2: "mh", a3: "MHL", name: "Marshall Islands", aliases: [], tiny: true },
  { iso2: "mr", a3: "MRT", name: "Mauritania", aliases: [] },
  { iso2: "mu", a3: "MUS", name: "Mauritius", aliases: [] },
  { iso2: "mx", a3: "MEX", name: "Mexico", aliases: ["México"] },
  { iso2: "fm", a3: "FSM", name: "Micronesia", aliases: ["Federated States of Micronesia", "FSM"], tiny: true },
  { iso2: "md", a3: "MDA", name: "Moldova", aliases: [] },
  { iso2: "mc", a3: "MCO", name: "Monaco", aliases: [], tiny: true },
  { iso2: "mn", a3: "MNG", name: "Mongolia", aliases: [] },
  { iso2: "me", a3: "MNE", name: "Montenegro", aliases: [] },
  { iso2: "ma", a3: "MAR", name: "Morocco", aliases: [] },
  { iso2: "mz", a3: "MOZ", name: "Mozambique", aliases: [] },
  { iso2: "mm", a3: "MMR", name: "Myanmar", aliases: ["Burma"] },
  { iso2: "na", a3: "NAM", name: "Namibia", aliases: [] },
  { iso2: "nr", a3: "NRU", name: "Nauru", aliases: [], tiny: true },
  { iso2: "np", a3: "NPL", name: "Nepal", aliases: [] },
  { iso2: "nl", a3: "NLD", name: "Netherlands", aliases: ["Holland", "The Netherlands"] },
  { iso2: "nz", a3: "NZL", name: "New Zealand", aliases: ["Aotearoa"] },
  { iso2: "ni", a3: "NIC", name: "Nicaragua", aliases: [] },
  { iso2: "ne", a3: "NER", name: "Niger", aliases: [] },
  { iso2: "ng", a3: "NGA", name: "Nigeria", aliases: [] },
  { iso2: "kp", a3: "PRK", name: "North Korea", aliases: ["DPRK", "Korea North"] },
  { iso2: "mk", a3: "MKD", name: "North Macedonia", aliases: ["Macedonia"] },
  { iso2: "no", a3: "NOR", name: "Norway", aliases: [] },
  { iso2: "om", a3: "OMN", name: "Oman", aliases: [] },
  { iso2: "pk", a3: "PAK", name: "Pakistan", aliases: [] },
  { iso2: "pw", a3: "PLW", name: "Palau", aliases: [], tiny: true },
  { iso2: "ps", a3: "PSX", name: "Palestine", aliases: ["State of Palestine"] },
  { iso2: "pa", a3: "PAN", name: "Panama", aliases: [] },
  { iso2: "pg", a3: "PNG", name: "Papua New Guinea", aliases: ["PNG"] },
  { iso2: "py", a3: "PRY", name: "Paraguay", aliases: [] },
  { iso2: "pe", a3: "PER", name: "Peru", aliases: [] },
  { iso2: "ph", a3: "PHL", name: "Philippines", aliases: [] },
  { iso2: "pl", a3: "POL", name: "Poland", aliases: [] },
  { iso2: "pt", a3: "PRT", name: "Portugal", aliases: [] },
  { iso2: "qa", a3: "QAT", name: "Qatar", aliases: [] },
  { iso2: "ro", a3: "ROU", name: "Romania", aliases: [] },
  { iso2: "ru", a3: "RUS", name: "Russia", aliases: ["Russian Federation"] },
  { iso2: "rw", a3: "RWA", name: "Rwanda", aliases: [] },
  { iso2: "kn", a3: "KNA", name: "Saint Kitts and Nevis", aliases: ["St Kitts and Nevis", "St Kitts"], tiny: true },
  { iso2: "lc", a3: "LCA", name: "Saint Lucia", aliases: ["St Lucia"], tiny: true },
  { iso2: "vc", a3: "VCT", name: "Saint Vincent and the Grenadines", aliases: ["St Vincent and the Grenadines", "St Vincent", "Saint Vincent"], tiny: true },
  { iso2: "ws", a3: "WSM", name: "Samoa", aliases: [] },
  { iso2: "sm", a3: "SMR", name: "San Marino", aliases: [], tiny: true },
  { iso2: "st", a3: "STP", name: "São Tomé and Príncipe", aliases: ["Sao Tome"], tiny: true },
  { iso2: "sa", a3: "SAU", name: "Saudi Arabia", aliases: ["KSA"] },
  { iso2: "sn", a3: "SEN", name: "Senegal", aliases: [] },
  { iso2: "rs", a3: "SRB", name: "Serbia", aliases: [] },
  { iso2: "sc", a3: "SYC", name: "Seychelles", aliases: [], tiny: true },
  { iso2: "sl", a3: "SLE", name: "Sierra Leone", aliases: [] },
  { iso2: "sg", a3: "SGP", name: "Singapore", aliases: [], tiny: true },
  { iso2: "sk", a3: "SVK", name: "Slovakia", aliases: [] },
  { iso2: "si", a3: "SVN", name: "Slovenia", aliases: [] },
  { iso2: "sb", a3: "SLB", name: "Solomon Islands", aliases: [] },
  { iso2: "so", a3: "SOM", name: "Somalia", aliases: [] },
  { iso2: "za", a3: "ZAF", name: "South Africa", aliases: ["RSA"] },
  { iso2: "kr", a3: "KOR", name: "South Korea", aliases: ["Korea", "Republic of Korea", "Korea South"] },
  { iso2: "ss", a3: "SDS", name: "South Sudan", aliases: [] },
  { iso2: "es", a3: "ESP", name: "Spain", aliases: ["España"] },
  { iso2: "lk", a3: "LKA", name: "Sri Lanka", aliases: ["Ceylon"] },
  { iso2: "sd", a3: "SDN", name: "Sudan", aliases: [] },
  { iso2: "sr", a3: "SUR", name: "Suriname", aliases: ["Surinam"] },
  { iso2: "se", a3: "SWE", name: "Sweden", aliases: [] },
  { iso2: "ch", a3: "CHE", name: "Switzerland", aliases: [] },
  { iso2: "sy", a3: "SYR", name: "Syria", aliases: [] },
  { iso2: "tw", a3: "TWN", name: "Taiwan", aliases: [] },
  { iso2: "tj", a3: "TJK", name: "Tajikistan", aliases: [] },
  { iso2: "tz", a3: "TZA", name: "Tanzania", aliases: [] },
  { iso2: "th", a3: "THA", name: "Thailand", aliases: ["Siam"] },
  { iso2: "tl", a3: "TLS", name: "Timor-Leste", aliases: ["East Timor"] },
  { iso2: "tg", a3: "TGO", name: "Togo", aliases: [] },
  { iso2: "to", a3: "TON", name: "Tonga", aliases: [], tiny: true },
  { iso2: "tt", a3: "TTO", name: "Trinidad and Tobago", aliases: ["Trinidad"] },
  { iso2: "tn", a3: "TUN", name: "Tunisia", aliases: [] },
  { iso2: "tr", a3: "TUR", name: "Türkiye", aliases: ["Turkey"] },
  { iso2: "tm", a3: "TKM", name: "Turkmenistan", aliases: [] },
  { iso2: "tv", a3: "TUV", name: "Tuvalu", aliases: [], tiny: true },
  { iso2: "ug", a3: "UGA", name: "Uganda", aliases: [] },
  { iso2: "ua", a3: "UKR", name: "Ukraine", aliases: [] },
  { iso2: "ae", a3: "ARE", name: "United Arab Emirates", aliases: ["UAE", "Emirates"] },
  { iso2: "gb", a3: "GBR", name: "United Kingdom", aliases: ["UK", "Britain", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland"] },
  { iso2: "us", a3: "USA", name: "United States", aliases: ["USA", "US", "America", "United States of America"] },
  { iso2: "uy", a3: "URY", name: "Uruguay", aliases: [] },
  { iso2: "uz", a3: "UZB", name: "Uzbekistan", aliases: [] },
  { iso2: "vu", a3: "VUT", name: "Vanuatu", aliases: [] },
  { iso2: "va", a3: "VAT", name: "Vatican City", aliases: ["Vatican", "Holy See"], tiny: true },
  { iso2: "ve", a3: "VEN", name: "Venezuela", aliases: [] },
  { iso2: "vn", a3: "VNM", name: "Vietnam", aliases: ["Viet Nam"] },
  { iso2: "ye", a3: "YEM", name: "Yemen", aliases: [] },
  { iso2: "zm", a3: "ZMB", name: "Zambia", aliases: [] },
  { iso2: "zw", a3: "ZWE", name: "Zimbabwe", aliases: [] },
];

export const COUNTRY_BY_ISO: Map<string, Country> = new Map(COUNTRIES.map((c) => [c.iso2, c]));
```

- [ ] **Step 6: Create `src/data/excluded.ts`**

```ts
/** Places a player may type that are recognised but are not countries in this game. */
export interface ExcludedEntry {
  name: string;
  aliases: string[];
  /** Completes the sentence "X isn't a country in this game — it's …". */
  reason: string;
}

const US = "a territory of the United States";
const UK = "a territory of the United Kingdom";
const UK_CROWN = "a British Crown Dependency";
const FR = "a territory of France";
const FR_REGION = "an overseas region of France";
const NL = "part of the Kingdom of the Netherlands";
const NZ = "in free association with New Zealand";
const AU = "a territory of Australia";
const CN = "a special administrative region of China";
const DK = "a territory of Denmark";

export const EXCLUDED: ExcludedEntry[] = [
  { name: "Greenland", aliases: [], reason: DK },
  { name: "Faroe Islands", aliases: ["Faroes", "Faeroe Islands"], reason: DK },
  { name: "Åland Islands", aliases: ["Aland", "Åland"], reason: "an autonomous region of Finland" },
  { name: "Puerto Rico", aliases: [], reason: US },
  { name: "Guam", aliases: [], reason: US },
  { name: "US Virgin Islands", aliases: ["United States Virgin Islands"], reason: US },
  { name: "American Samoa", aliases: [], reason: US },
  { name: "Northern Mariana Islands", aliases: [], reason: US },
  { name: "Falkland Islands", aliases: ["Falklands", "Malvinas"], reason: UK },
  { name: "Bermuda", aliases: [], reason: UK },
  { name: "Cayman Islands", aliases: [], reason: UK },
  { name: "British Virgin Islands", aliases: [], reason: UK },
  { name: "Turks and Caicos Islands", aliases: ["Turks and Caicos"], reason: UK },
  { name: "Anguilla", aliases: [], reason: UK },
  { name: "Montserrat", aliases: [], reason: UK },
  { name: "Saint Helena", aliases: [], reason: UK },
  { name: "Pitcairn Islands", aliases: [], reason: UK },
  { name: "South Georgia", aliases: ["South Georgia and the South Sandwich Islands"], reason: UK },
  { name: "British Indian Ocean Territory", aliases: ["Chagos Islands"], reason: UK },
  { name: "Jersey", aliases: [], reason: UK_CROWN },
  { name: "Guernsey", aliases: [], reason: UK_CROWN },
  { name: "Isle of Man", aliases: [], reason: UK_CROWN },
  { name: "French Polynesia", aliases: ["Tahiti"], reason: FR },
  { name: "New Caledonia", aliases: [], reason: FR },
  { name: "Wallis and Futuna", aliases: [], reason: FR },
  { name: "Saint Pierre and Miquelon", aliases: [], reason: FR },
  { name: "Saint Martin", aliases: [], reason: FR },
  { name: "Saint Barthélemy", aliases: ["St Barts"], reason: FR },
  { name: "French Southern and Antarctic Lands", aliases: [], reason: FR },
  { name: "French Guiana", aliases: [], reason: FR_REGION },
  { name: "Réunion", aliases: [], reason: FR_REGION },
  { name: "Guadeloupe", aliases: [], reason: FR_REGION },
  { name: "Martinique", aliases: [], reason: FR_REGION },
  { name: "Mayotte", aliases: [], reason: FR_REGION },
  { name: "Aruba", aliases: [], reason: NL },
  { name: "Curaçao", aliases: [], reason: NL },
  { name: "Sint Maarten", aliases: [], reason: NL },
  { name: "Cook Islands", aliases: [], reason: NZ },
  { name: "Niue", aliases: [], reason: NZ },
  { name: "Hong Kong", aliases: [], reason: CN },
  { name: "Macau", aliases: ["Macao"], reason: CN },
  { name: "Norfolk Island", aliases: [], reason: AU },
  { name: "Christmas Island", aliases: [], reason: AU },
  { name: "Cocos Islands", aliases: ["Cocos (Keeling) Islands", "Keeling Islands"], reason: AU },
  { name: "Heard Island and McDonald Islands", aliases: [], reason: AU },
  { name: "Western Sahara", aliases: [], reason: "a disputed territory" },
  { name: "Somaliland", aliases: [], reason: "counted as part of Somalia" },
  { name: "Northern Cyprus", aliases: [], reason: "counted as part of Cyprus" },
  { name: "Antarctica", aliases: [], reason: "a continent" },
];
```

- [ ] **Step 7: Create `docs/excluded-countries.md`.** A test parses this table, so keep one row per entry and the first column exactly equal to `name`.

```markdown
# Excluded places

Every sovereign country (193 UN members plus Vatican City, Palestine, Kosovo and Taiwan) is playable, including micro-states. Tiny ones (land < 1,000 km²) trigger a "difficult round" warning when they are the secret.

The places below are **not** countries in this game. Typing one shows an explanation and does not count as a guess. Most are still drawn on the globe as plain land. The source of truth is `src/data/excluded.ts`, and `src/data/countries.test.ts` checks that this table matches it.

| Name | Why it's excluded |
|---|---|
| Greenland | a territory of Denmark |
| Faroe Islands | a territory of Denmark |
| Åland Islands | an autonomous region of Finland |
| Puerto Rico | a territory of the United States |
| Guam | a territory of the United States |
| US Virgin Islands | a territory of the United States |
| American Samoa | a territory of the United States |
| Northern Mariana Islands | a territory of the United States |
| Falkland Islands | a territory of the United Kingdom |
| Bermuda | a territory of the United Kingdom |
| Cayman Islands | a territory of the United Kingdom |
| British Virgin Islands | a territory of the United Kingdom |
| Turks and Caicos Islands | a territory of the United Kingdom |
| Anguilla | a territory of the United Kingdom |
| Montserrat | a territory of the United Kingdom |
| Saint Helena | a territory of the United Kingdom |
| Pitcairn Islands | a territory of the United Kingdom |
| South Georgia | a territory of the United Kingdom |
| British Indian Ocean Territory | a territory of the United Kingdom |
| Jersey | a British Crown Dependency |
| Guernsey | a British Crown Dependency |
| Isle of Man | a British Crown Dependency |
| French Polynesia | a territory of France |
| New Caledonia | a territory of France |
| Wallis and Futuna | a territory of France |
| Saint Pierre and Miquelon | a territory of France |
| Saint Martin | a territory of France |
| Saint Barthélemy | a territory of France |
| French Southern and Antarctic Lands | a territory of France |
| French Guiana | an overseas region of France |
| Réunion | an overseas region of France |
| Guadeloupe | an overseas region of France |
| Martinique | an overseas region of France |
| Mayotte | an overseas region of France |
| Aruba | part of the Kingdom of the Netherlands |
| Curaçao | part of the Kingdom of the Netherlands |
| Sint Maarten | part of the Kingdom of the Netherlands |
| Cook Islands | in free association with New Zealand |
| Niue | in free association with New Zealand |
| Hong Kong | a special administrative region of China |
| Macau | a special administrative region of China |
| Norfolk Island | a territory of Australia |
| Christmas Island | a territory of Australia |
| Cocos Islands | a territory of Australia |
| Heard Island and McDonald Islands | a territory of Australia |
| Western Sahara | a disputed territory |
| Somaliland | counted as part of Somalia (its shape is merged into Somalia) |
| Northern Cyprus | counted as part of Cyprus (its shape is merged into Cyprus) |
| Antarctica | a continent |
```

- [ ] **Step 8: Write the data integrity tests** in `src/data/countries.test.ts`

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { COUNTRIES, COUNTRY_BY_ISO } from "./countries";
import { EXCLUDED } from "./excluded";
import { normalize } from "@/src/lib/normalize";

describe("COUNTRIES", () => {
  test("has 197 countries, 25 of them tiny", () => {
    expect(COUNTRIES).toHaveLength(197);
    expect(COUNTRIES.filter((c) => c.tiny)).toHaveLength(25);
  });

  test("iso2 and a3 codes are unique", () => {
    expect(new Set(COUNTRIES.map((c) => c.iso2)).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((c) => c.a3)).size).toBe(COUNTRIES.length);
    expect(COUNTRY_BY_ISO.size).toBe(COUNTRIES.length);
  });

  test("every name and alias normalises to a key owned by exactly one place", () => {
    const owner = new Map<string, string>();
    const claim = (key: string, who: string) => {
      const prev = owner.get(key);
      expect(prev === undefined || prev === who, `"${key}" claimed by ${prev} and ${who}`).toBe(true);
      owner.set(key, who);
    };
    for (const c of COUNTRIES) for (const n of [c.name, ...c.aliases]) claim(normalize(n), c.iso2);
    for (const e of EXCLUDED) for (const n of [e.name, ...e.aliases]) claim(normalize(n), `excluded:${e.name}`);
  });

  test("every country has a flag-icons SVG", () => {
    for (const c of COUNTRIES) {
      const svg = path.join(process.cwd(), "node_modules", "flag-icons", "flags", "4x3", `${c.iso2}.svg`);
      expect(fs.existsSync(svg), `missing flag for ${c.name}`).toBe(true);
    }
  });
});

describe("docs/excluded-countries.md", () => {
  test("lists exactly the entries in EXCLUDED", () => {
    const md = fs.readFileSync(path.join(process.cwd(), "docs", "excluded-countries.md"), "utf8");
    const names = md
      .split(/\r?\n/)
      .filter((line) => line.startsWith("| ") && !line.startsWith("| Name ") && !line.startsWith("|---"))
      .map((line) => line.split("|")[1].trim());
    expect(names.sort()).toEqual(EXCLUDED.map((e) => e.name).sort());
  });
});
```

- [ ] **Step 9: Run all tests**

Run: `pnpm test`
Expected: all pass (normalize 12, countries 4, docs 1).

- [ ] **Step 10: Commit**

```bash
git add src/lib/normalize.ts src/lib/normalize.test.ts src/data docs/excluded-countries.md
git commit -m "feat: add country list, excluded territories and name normalisation

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Country matcher with did-you-mean

**Files:**
- Create: `src/lib/match.ts`, `src/lib/match.test.ts`

**Interfaces:**
- Consumes: `normalize`, `COUNTRIES`, `Country`, `EXCLUDED`, `ExcludedEntry` (Task 2)
- Produces:
  ```ts
  type MatchResult =
    | { kind: "exact"; country: Country }
    | { kind: "excluded"; entry: ExcludedEntry }
    | { kind: "suggest"; countries: Country[] }   // 1..3, best first
    | { kind: "none" };
  function matchCountry(input: string): MatchResult;
  function damerauLevenshtein(a: string, b: string): number;
  function excludedMessage(entry: ExcludedEntry): string;
  ```

- [ ] **Step 1: Write the failing tests** in `src/lib/match.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { damerauLevenshtein, excludedMessage, matchCountry } from "./match";

const names = (r: ReturnType<typeof matchCountry>) => (r.kind === "suggest" ? r.countries.map((c) => c.name) : []);

describe("damerauLevenshtein", () => {
  test("counts a transposition as one edit", () => {
    expect(damerauLevenshtein("kyrgzystan", "kyrgyzstan")).toBe(1);
  });
  test("insertions, deletions, substitutions", () => {
    expect(damerauLevenshtein("", "abc")).toBe(3);
    expect(damerauLevenshtein("grenda", "grenada")).toBe(1);
    expect(damerauLevenshtein("phillipines", "philippines")).toBe(2);
  });
});

describe("matchCountry", () => {
  test.each([
    ["France", "France"],
    ["USA", "United States"],
    ["uk", "United Kingdom"],
    ["Ivory Coast", "Côte d'Ivoire"],
    ["cote divoire", "Côte d'Ivoire"],
    ["Burma", "Myanmar"],
    ["st. lucia", "Saint Lucia"],
    ["Saint Lucia", "Saint Lucia"],
    ["the netherlands", "Netherlands"],
    ["Congo", "Republic of the Congo"],
    ["DRC", "DR Congo"],
    ["Turkey", "Türkiye"],
    ["Guinea", "Guinea"],
    ["Niger", "Niger"],
    ["Bosnia & Herzegovina", "Bosnia and Herzegovina"],
  ])("exact: %s → %s", (input, expected) => {
    const r = matchCountry(input);
    expect(r.kind).toBe("exact");
    if (r.kind === "exact") expect(r.country.name).toBe(expected);
  });

  test.each([
    ["Kyrgzystan", "Kyrgyzstan"],
    ["Phillipines", "Philippines"],
    ["Argentinia", "Argentina"],
    ["Grenda", "Grenada"],
    ["Swizerland", "Switzerland"],
    ["Columbia", "Colombia"],
    ["Azerb", "Azerbaijan"],
  ])("suggest: %s → %s first", (input, expected) => {
    const r = matchCountry(input);
    expect(r.kind).toBe("suggest");
    expect(names(r)[0]).toBe(expected);
  });

  test("ties are broken by shorter name", () => {
    expect(names(matchCountry("Nigera"))).toEqual(["Niger", "Nigeria"]);
  });

  test("returns at most 3 suggestions and includes both plausible targets", () => {
    const n = names(matchCountry("Austrlia"));
    expect(n.length).toBeLessThanOrEqual(3);
    expect(n).toContain("Australia");
    expect(n).toContain("Austria");
  });

  test("excluded territory", () => {
    const r = matchCountry("greenland");
    expect(r.kind).toBe("excluded");
    if (r.kind === "excluded") {
      expect(excludedMessage(r.entry)).toBe("Greenland isn't a country in this game — it's a territory of Denmark.");
    }
  });

  test("gibberish and blank give none", () => {
    expect(matchCountry("xqzv").kind).toBe("none");
    expect(matchCountry("   ").kind).toBe("none");
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm test src/lib/match.test.ts`
Expected: FAIL, module `./match` not found.

- [ ] **Step 3: Implement `src/lib/match.ts`**

```ts
import { COUNTRIES, type Country } from "@/src/data/countries";
import { EXCLUDED, type ExcludedEntry } from "@/src/data/excluded";
import { normalize } from "./normalize";

export type MatchResult =
  | { kind: "exact"; country: Country }
  | { kind: "excluded"; entry: ExcludedEntry }
  | { kind: "suggest"; countries: Country[] }
  | { kind: "none" };

const MAX_SUGGESTIONS = 3;
const MIN_PREFIX = 4;

const COUNTRY_KEYS = COUNTRIES.flatMap((country) =>
  [country.name, ...country.aliases].map((n) => ({ key: normalize(n), country })),
);
const EXCLUDED_KEYS = new Map(EXCLUDED.flatMap((e) => [e.name, ...e.aliases].map((n) => [normalize(n), e] as const)));

/** Optimal-string-alignment distance: insert, delete, substitute, swap adjacent = 1 each. */
export function damerauLevenshtein(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = new Array<number>(b.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

export function matchCountry(input: string): MatchResult {
  const q = normalize(input);
  if (!q) return { kind: "none" };

  const exact = COUNTRY_KEYS.find((e) => e.key === q);
  if (exact) return { kind: "exact", country: exact.country };

  const excluded = EXCLUDED_KEYS.get(q);
  if (excluded) return { kind: "excluded", entry: excluded };

  const best = new Map<Country, number>();
  for (const { key, country } of COUNTRY_KEYS) {
    const isPrefix = q.length >= MIN_PREFIX && key.startsWith(q);
    const dist = damerauLevenshtein(q, key);
    if (!isPrefix && dist > Math.max(1, Math.floor(key.length / 4))) continue;
    const score = isPrefix ? Math.min(dist, 0.5) : dist;
    const prev = best.get(country);
    if (prev === undefined || score < prev) best.set(country, score);
  }

  const countries = [...best.entries()]
    .sort(([a, sa], [b, sb]) => sa - sb || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, MAX_SUGGESTIONS)
    .map(([c]) => c);
  return countries.length > 0 ? { kind: "suggest", countries } : { kind: "none" };
}

export function excludedMessage(entry: ExcludedEntry): string {
  return `${entry.name} isn't a country in this game — it's ${entry.reason}.`;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm test src/lib/match.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/match.ts src/lib/match.test.ts
git commit -m "feat: add country matcher with did-you-mean suggestions

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Presentation helpers (heat colour, clue text, zoom thresholds)

**Files:**
- Create: `src/lib/heat.ts`, `src/lib/heat.test.ts`
- Create: `src/lib/format.ts`, `src/lib/format.test.ts`
- Create: `src/lib/zoom.ts`, `src/lib/zoom.test.ts`

**Interfaces:**
- Produces: `MAX_KM = 8000`, `WIN_COLOR = "#1fbf5b"`, `UNKNOWN_COLOR = "#9aa0a6"`, `heatColor(km: number | null): string` (`#rrggbb`), `hexToRgb(hex: string): [number, number, number]`
- Produces: `formatClue(km: number | null): string`
- Produces: `ringAlpha(altitude: number): number` (0..1), `labelMaxAltitude(areaKm2: number): number`

- [ ] **Step 1: Write the failing tests**

`src/lib/heat.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { heatColor, hexToRgb, MAX_KM, UNKNOWN_COLOR } from "./heat";

const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe("heatColor", () => {
  test("endpoints", () => {
    expect(heatColor(0)).toBe("#b3001b");
    expect(heatColor(MAX_KM)).toBe("#fff3d6");
  });
  test("clamps beyond MAX_KM and below 0", () => {
    expect(heatColor(20000)).toBe("#fff3d6");
    expect(heatColor(-5)).toBe("#b3001b");
  });
  test("unknown distance is neutral", () => {
    expect(heatColor(null)).toBe(UNKNOWN_COLOR);
  });
  test("gets lighter as distance grows", () => {
    let prev = -1;
    for (let km = 0; km <= MAX_KM; km += 250) {
      const l = luminance(heatColor(km));
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
  });
});

describe("hexToRgb", () => {
  test("parses #rrggbb", () => {
    expect(hexToRgb("#1fbf5b")).toEqual([31, 191, 91]);
  });
});
```

`src/lib/format.test.ts`:

```ts
import { expect, test } from "vitest";
import { formatClue } from "./format";

test("formatClue", () => {
  expect(formatClue(0)).toBe("Shares a border!");
  expect(formatClue(37)).toBe("Closest border: 37 km");
  expect(formatClue(1240)).toBe("Closest border: 1,240 km");
  expect(formatClue(null)).toBe("Distance unknown");
});
```

`src/lib/zoom.test.ts`:

```ts
import { expect, test } from "vitest";
import { labelMaxAltitude, ringAlpha } from "./zoom";

test("ringAlpha fades out between altitude 0.2 and 0.1", () => {
  expect(ringAlpha(2)).toBe(1);
  expect(ringAlpha(0.2)).toBe(1);
  expect(ringAlpha(0.15)).toBeCloseTo(0.5);
  expect(ringAlpha(0.1)).toBe(0);
  expect(ringAlpha(0.03)).toBe(0);
});

test("labelMaxAltitude shows big countries from further away", () => {
  expect(labelMaxAltitude(17_000_000)).toBe(Infinity);
  expect(labelMaxAltitude(500_000)).toBe(2.2);
  expect(labelMaxAltitude(50_000)).toBe(1.2);
  expect(labelMaxAltitude(5_000)).toBe(0.6);
  expect(labelMaxAltitude(300)).toBe(0.3);
});
```

- [ ] **Step 2: Run them and verify they fail**

Run: `pnpm test src/lib/heat.test.ts src/lib/format.test.ts src/lib/zoom.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/lib/heat.ts`:

```ts
export const MAX_KM = 8000;
export const WIN_COLOR = "#1fbf5b";
export const UNKNOWN_COLOR = "#9aa0a6";

type RGB = [number, number, number];

const STOPS: ReadonlyArray<readonly [number, RGB]> = [
  [0, [0xb3, 0x00, 0x1b]],
  [0.35, [0xe8, 0x54, 0x1e]],
  [0.65, [0xf7, 0xb5, 0x38]],
  [1, [0xff, 0xf3, 0xd6]],
];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: RGB) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** Deep red for neighbours → pale cream for ≥ MAX_KM. sqrt spreads the near range. */
export function heatColor(km: number | null): string {
  if (km === null) return UNKNOWN_COLOR;
  const t = Math.sqrt(Math.min(Math.max(km, 0), MAX_KM) / MAX_KM);
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    if (t <= t1) {
      const [t0, c0] = STOPS[i - 1];
      const f = (t - t0) / (t1 - t0);
      return toHex([0, 1, 2].map((k) => c0[k] + (c1[k] - c0[k]) * f) as RGB);
    }
  }
  return toHex(STOPS[STOPS.length - 1][1]);
}
```

`src/lib/format.ts`:

```ts
const numberFormat = new Intl.NumberFormat("en-US");

export function formatClue(km: number | null): string {
  if (km === null) return "Distance unknown";
  if (km === 0) return "Shares a border!";
  return `Closest border: ${numberFormat.format(km)} km`;
}
```

`src/lib/zoom.ts`:

```ts
const RING_VISIBLE_ABOVE = 0.2;
const RING_HIDDEN_BELOW = 0.1;

/** Opacity of tiny-country marker rings: they fade out as the real shape becomes visible. */
export function ringAlpha(altitude: number): number {
  if (altitude >= RING_VISIBLE_ABOVE) return 1;
  if (altitude <= RING_HIDDEN_BELOW) return 0;
  return (altitude - RING_HIDDEN_BELOW) / (RING_VISIBLE_ABOVE - RING_HIDDEN_BELOW);
}

/** Camera altitude (globe radii) above which a country's overlay label is hidden. */
export function labelMaxAltitude(areaKm2: number): number {
  if (areaKm2 >= 1_000_000) return Infinity;
  if (areaKm2 >= 200_000) return 2.2;
  if (areaKm2 >= 30_000) return 1.2;
  if (areaKm2 >= 2_000) return 0.6;
  return 0.3;
}
```

- [ ] **Step 4: Run and verify they pass**

Run: `pnpm test src/lib/heat.test.ts src/lib/format.test.ts src/lib/zoom.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/heat.ts src/lib/heat.test.ts src/lib/format.ts src/lib/format.test.ts src/lib/zoom.ts src/lib/zoom.test.ts
git commit -m "feat: add heat colour scale, clue text and zoom thresholds

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Spherical geometry for nearest-border distance

**Files:**
- Create: `scripts/lib/sphere.ts`, `scripts/lib/sphere.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Vec3 = readonly [number, number, number];
  const EARTH_RADIUS_KM = 6371;
  function toVec(lng: number, lat: number): Vec3;
  function angle(a: Vec3, b: Vec3): number;             // radians
  function pointToArc(p: Vec3, a: Vec3, b: Vec3): number; // radians, p to great-circle segment a–b
  interface Shape { pts: Vec3[]; segs: [Vec3, Vec3][]; center: Vec3; radius: number; maxSeg: number; coarse: Vec3[] }
  function buildShape(multiPolygon: number[][][][]): Shape; // GeoJSON MultiPolygon coordinates [lng, lat]
  function minDistanceKm(a: Shape, b: Shape): number;
  ```

**Algorithm:** An upper bound `ub` comes from comparing up to 300 sampled vertices per shape. Then an exact pass checks vertex-to-segment distances in both directions, pruned by bounding caps: a point must lie within `otherRadius + ub + maxSeg` of the other shape's center. The prototype ran this over all 239 Natural Earth features in about 107 s. Doing all the math on 3D unit vectors means crossing the antimeridian needs no special handling.

- [ ] **Step 1: Write the failing tests** in `scripts/lib/sphere.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { angle, buildShape, EARTH_RADIUS_KM, minDistanceKm, pointToArc, toVec } from "./sphere";

const ONE_DEG_KM = (Math.PI / 180) * EARTH_RADIUS_KM; // ≈ 111.19

const square = (lng: number, lat: number, size: number): number[][][][] => [
  [[[lng, lat], [lng + size, lat], [lng + size, lat + size], [lng, lat + size], [lng, lat]]],
];

describe("vectors", () => {
  test("toVec puts (0,0) on the x axis", () => {
    const [x, y, z] = toVec(0, 0);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(0);
  });
  test("angle between equator points 90° apart", () => {
    expect(angle(toVec(0, 0), toVec(90, 0))).toBeCloseTo(Math.PI / 2);
  });
});

describe("pointToArc", () => {
  test("perpendicular distance to the middle of an arc", () => {
    const d = pointToArc(toVec(0, 1), toVec(-1, 0), toVec(1, 0)) * EARTH_RADIUS_KM;
    expect(d).toBeCloseTo(ONE_DEG_KM, 0);
  });
  test("falls back to the nearest endpoint beyond the arc", () => {
    const d = pointToArc(toVec(3, 0), toVec(-1, 0), toVec(1, 0)) * EARTH_RADIUS_KM;
    expect(d).toBeCloseTo(2 * ONE_DEG_KM, 0);
  });
});

describe("minDistanceKm", () => {
  test("two squares 1° apart at the equator", () => {
    const d = minDistanceKm(buildShape(square(0, 0, 1)), buildShape(square(2, 0, 1)));
    expect(d).toBeCloseTo(ONE_DEG_KM, 0);
  });
  test("works across the antimeridian", () => {
    // 178°..179° and -180°..-179° are 1° apart across the dateline.
    const d = minDistanceKm(buildShape(square(178, 0, 1)), buildShape(square(-180, 0, 1)));
    expect(d).toBeCloseTo(ONE_DEG_KM, 0);
  });
  test("touching shapes are 0 km apart", () => {
    const d = minDistanceKm(buildShape(square(0, 0, 1)), buildShape(square(1, 0, 1)));
    expect(d).toBeLessThan(0.001);
  });
  test("distance from a point to the middle of a long edge (not just vertices)", () => {
    // Big square's top edge runs lng 0..10 at lat 0; the small square sits 1° above its middle.
    const big = buildShape([[[[0, -10], [10, -10], [10, 0], [0, 0], [0, -10]]]]);
    const small = buildShape(square(4.9, 1, 0.2));
    expect(minDistanceKm(big, small)).toBeCloseTo(ONE_DEG_KM, -1);
  });
});
```

- [ ] **Step 2: Run them and verify they fail**

Run: `pnpm test scripts/lib/sphere.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `scripts/lib/sphere.ts`**

```ts
export type Vec3 = readonly [number, number, number];

export const EARTH_RADIUS_KM = 6371;
const COARSE_SAMPLES = 300;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => {
  const n = length(a);
  return [a[0] / n, a[1] / n, a[2] / n];
};

export function toVec(lng: number, lat: number): Vec3 {
  const l = (lng * Math.PI) / 180;
  const p = (lat * Math.PI) / 180;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}

/** Central angle in radians (numerically stable for tiny angles). */
export function angle(a: Vec3, b: Vec3): number {
  return Math.atan2(length(cross(a, b)), dot(a, b));
}

/** Angle from p to the minor great-circle arc a→b. */
export function pointToArc(p: Vec3, a: Vec3, b: Vec3): number {
  const n = cross(a, b);
  const nl = length(n);
  if (nl < 1e-12) return angle(p, a);
  const nn: Vec3 = [n[0] / nl, n[1] / nl, n[2] / nl];
  const d = dot(p, nn);
  const proj: Vec3 = [p[0] - d * nn[0], p[1] - d * nn[1], p[2] - d * nn[2]];
  const withinArc = dot(cross(a, proj), nn) >= 0 && dot(cross(proj, b), nn) >= 0;
  if (withinArc) return Math.abs(Math.asin(Math.max(-1, Math.min(1, d))));
  return Math.min(angle(p, a), angle(p, b));
}

export interface Shape {
  pts: Vec3[];
  segs: [Vec3, Vec3][];
  center: Vec3;
  /** Max angle from center to any vertex. */
  radius: number;
  /** Longest segment, as an angle. */
  maxSeg: number;
  coarse: Vec3[];
}

export function buildShape(multiPolygon: number[][][][]): Shape {
  const pts: Vec3[] = [];
  const segs: [Vec3, Vec3][] = [];
  let maxSeg = 0;
  for (const polygon of multiPolygon) {
    for (const ring of polygon) {
      const v = ring.map(([lng, lat]) => toVec(lng, lat));
      for (let i = 0; i < v.length; i++) {
        pts.push(v[i]);
        if (i + 1 < v.length) {
          segs.push([v[i], v[i + 1]]);
          maxSeg = Math.max(maxSeg, angle(v[i], v[i + 1]));
        }
      }
    }
  }
  const sum: [number, number, number] = [0, 0, 0];
  for (const p of pts) {
    sum[0] += p[0];
    sum[1] += p[1];
    sum[2] += p[2];
  }
  const center = unit(sum);
  let radius = 0;
  for (const p of pts) radius = Math.max(radius, angle(p, center));
  const step = Math.max(1, Math.ceil(pts.length / COARSE_SAMPLES));
  const coarse = pts.filter((_, i) => i % step === 0);
  return { pts, segs, center, radius, maxSeg, coarse };
}

function directed(from: Shape, to: Shape, ub: number, best: number): number {
  const ptReach = to.radius + ub;
  const segReach = from.radius + ub + to.maxSeg;
  const points = from.pts.filter((p) => angle(p, to.center) <= ptReach);
  const segs = to.segs.filter(([s]) => angle(s, from.center) <= segReach);
  for (const p of points) {
    for (const [s, e] of segs) {
      const d = pointToArc(p, s, e);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Minimum great-circle distance between the boundaries of two shapes, in km. */
export function minDistanceKm(a: Shape, b: Shape): number {
  let ub = Infinity;
  for (const p of a.coarse) {
    for (const q of b.coarse) {
      const d = angle(p, q);
      if (d < ub) ub = d;
    }
  }
  let best = directed(a, b, ub, ub);
  best = directed(b, a, ub, best);
  return best * EARTH_RADIUS_KM;
}
```

- [ ] **Step 4: Run and verify they pass**

Run: `pnpm test scripts/lib/sphere.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/sphere.ts scripts/lib/sphere.test.ts
git commit -m "feat: add spherical nearest-border distance

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Shared data types and distance lookup

**Files:**
- Create: `src/lib/types.ts`, `src/lib/distance.ts`, `src/lib/distance.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface CountryFeatureProps { a3: string; iso2: string | null; name: string; playable: boolean; tiny: boolean; labelLat: number; labelLng: number; areaKm2: number }
  type CountryFeature = Feature<MultiPolygon, CountryFeatureProps>;
  interface DistanceTable { ids: string[]; km: number[] } // ids = iso2 in COUNTRIES order; km = upper triangle, row-major
  function triangleIndex(i: number, j: number, n: number): number; // requires i < j
  type DistanceLookup = (a: string, b: string) => number | null;
  function createDistanceLookup(table: DistanceTable): DistanceLookup;
  ```

- [ ] **Step 1: Create `src/lib/types.ts`**

```ts
import type { Feature, MultiPolygon } from "geojson";

export interface CountryFeatureProps {
  a3: string;
  /** null for drawn-but-not-playable land (territories, Antarctica). */
  iso2: string | null;
  name: string;
  playable: boolean;
  tiny: boolean;
  labelLat: number;
  labelLng: number;
  areaKm2: number;
}

export type CountryFeature = Feature<MultiPolygon, CountryFeatureProps>;

/** Nearest-border km between playable countries. `km` is the upper triangle (i < j), row-major. */
export interface DistanceTable {
  ids: string[];
  km: number[];
}
```

- [ ] **Step 2: Write the failing test** in `src/lib/distance.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { createDistanceLookup, triangleIndex } from "./distance";

describe("triangleIndex", () => {
  test("enumerates the upper triangle row by row", () => {
    const n = 4;
    const seen: number[] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) seen.push(triangleIndex(i, j, n));
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("createDistanceLookup", () => {
  // a-b 10, a-c 20, b-c 30
  const lookup = createDistanceLookup({ ids: ["a", "b", "c"], km: [10, 20, 30] });

  test("is symmetric", () => {
    expect(lookup("a", "b")).toBe(10);
    expect(lookup("b", "a")).toBe(10);
    expect(lookup("c", "a")).toBe(20);
    expect(lookup("b", "c")).toBe(30);
  });
  test("same country is 0", () => {
    expect(lookup("b", "b")).toBe(0);
  });
  test("unknown id is null", () => {
    expect(lookup("a", "zz")).toBeNull();
  });
});
```

- [ ] **Step 3: Run it and verify it fails**

Run: `pnpm test src/lib/distance.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement `src/lib/distance.ts`**

```ts
import type { DistanceTable } from "./types";

export type DistanceLookup = (a: string, b: string) => number | null;

/** Position of pair (i, j), i < j, in a row-major upper-triangle array of an n×n matrix. */
export function triangleIndex(i: number, j: number, n: number): number {
  return i * n - (i * (i + 1)) / 2 + (j - i - 1);
}

export function createDistanceLookup(table: DistanceTable): DistanceLookup {
  const n = table.ids.length;
  const pos = new Map(table.ids.map((id, i) => [id, i]));
  return (a, b) => {
    const i = pos.get(a);
    const j = pos.get(b);
    if (i === undefined || j === undefined) return null;
    if (i === j) return 0;
    const km = table.km[i < j ? triangleIndex(i, j, n) : triangleIndex(j, i, n)];
    return km ?? null;
  };
}
```

- [ ] **Step 5: Run and verify it passes, then commit**

Run: `pnpm test src/lib/distance.test.ts`
Expected: all pass.

```bash
git add src/lib/types.ts src/lib/distance.ts src/lib/distance.test.ts
git commit -m "feat: add data types and distance table lookup

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Data build script and generated data

**Files:**
- Create: `scripts/build-data.ts`
- Generate (and commit): `public/data/countries.geojson`, `public/data/distances.json`
- Create: `src/data/generated.test.ts`

**Interfaces:**
- Consumes: `COUNTRIES` (Task 2), `buildShape`, `minDistanceKm`, `EARTH_RADIUS_KM` (Task 5), `CountryFeatureProps`, `DistanceTable`, `createDistanceLookup` (Task 6)
- Produces: `public/data/countries.geojson`, a `FeatureCollection<MultiPolygon, CountryFeatureProps>` with every Natural Earth feature except merged ones. It contains all 197 playable countries plus territories and Antarctica as non-playable land.
- Produces: `public/data/distances.json`, a `DistanceTable` over the 197 playable countries in `COUNTRIES` order (19,306 values).

- [ ] **Step 1: Write the failing generated-data tests** in `src/data/generated.test.ts`

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { FeatureCollection, MultiPolygon } from "geojson";
import { COUNTRIES } from "./countries";
import { createDistanceLookup } from "@/src/lib/distance";
import type { CountryFeatureProps, DistanceTable } from "@/src/lib/types";

const read = <T,>(file: string): T =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", file), "utf8")) as T;

const geo = read<FeatureCollection<MultiPolygon, CountryFeatureProps>>("countries.geojson");
const table = read<DistanceTable>("distances.json");
const km = createDistanceLookup(table);

describe("countries.geojson", () => {
  test("every playable country has exactly one feature with geometry", () => {
    for (const c of COUNTRIES) {
      const matches = geo.features.filter((f) => f.properties.iso2 === c.iso2);
      expect(matches, c.name).toHaveLength(1);
      expect(matches[0].properties.playable).toBe(true);
      expect(matches[0].properties.tiny).toBe(c.tiny === true);
      expect(matches[0].geometry.coordinates.length, c.name).toBeGreaterThan(0);
    }
  });
  test("non-playable land has no iso2", () => {
    for (const f of geo.features.filter((f) => !f.properties.playable)) expect(f.properties.iso2).toBeNull();
  });
  test("Somaliland and Northern Cyprus are merged away", () => {
    const a3s = geo.features.map((f) => f.properties.a3);
    expect(a3s).not.toContain("SOL");
    expect(a3s).not.toContain("CYN");
  });
});

describe("distances.json", () => {
  test("covers all playable countries", () => {
    const n = COUNTRIES.length;
    expect(table.ids).toEqual(COUNTRIES.map((c) => c.iso2));
    expect(table.km).toHaveLength((n * (n - 1)) / 2);
    expect(table.km.every((v) => Number.isInteger(v) && v >= 0)).toBe(true);
  });
  test("land neighbours are 0 km", () => {
    expect(km("fr", "es")).toBe(0);
    expect(km("de", "pl")).toBe(0);
    expect(km("so", "et")).toBe(0);
    expect(km("it", "va")).toBe(0);
    expect(km("it", "sm")).toBe(0);
    expect(km("za", "ls")).toBe(0);
  });
  test("known sea gaps and long distances", () => {
    expect(km("gb", "fr")).toBeGreaterThan(0);
    expect(km("gb", "fr")).toBeLessThan(100);
    expect(km("gd", "vc")).toBeGreaterThan(0);
    expect(km("gd", "vc")).toBeLessThan(200);
    expect(km("au", "br")).toBeGreaterThan(8000);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm test src/data/generated.test.ts`
Expected: FAIL, ENOENT for `public/data/countries.geojson`.

- [ ] **Step 3: Create `scripts/build-data.ts`**

```ts
/**
 * One-off data pipeline: Natural Earth admin-0 → public/data/countries.geojson + distances.json.
 * Run with `pnpm data:build` (downloads into .cache/, takes ~1–2 minutes). Commit the output.
 */
import fs from "node:fs";
import path from "node:path";
import { geoArea } from "d3-geo";
import { topology } from "topojson-server";
import { neighbors } from "topojson-client";
import type { GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { COUNTRIES } from "../src/data/countries";
import type { CountryFeatureProps, DistanceTable } from "../src/lib/types";
import { buildShape, EARTH_RADIUS_KM, minDistanceKm } from "./lib/sphere";

const ROOT = process.cwd();
const CACHE = path.join(ROOT, ".cache", "naturalearth");
const OUT = path.join(ROOT, "public", "data");
const SOURCES = {
  "50m": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson",
  "10m": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson",
} as const;
/** Natural Earth splits these off; this game counts them as part of their UN-recognised country. */
const MERGE: Record<string, string> = { SOL: "SOM", CYN: "CYP" };

interface NEProps {
  ADM0_A3: string;
  ADMIN: string;
  LABEL_X: number;
  LABEL_Y: number;
}
type NEFeature = Feature<Polygon | MultiPolygon, NEProps>;

async function load(res: keyof typeof SOURCES): Promise<NEFeature[]> {
  const file = path.join(CACHE, `ne_${res}_admin_0_countries.geojson`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(CACHE, { recursive: true });
    console.log(`Downloading Natural Earth ${res}…`);
    const response = await fetch(SOURCES[res]);
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${SOURCES[res]}`);
    fs.writeFileSync(file, await response.text());
  }
  return (JSON.parse(fs.readFileSync(file, "utf8")) as FeatureCollection<Polygon | MultiPolygon, NEProps>).features;
}

const polygonsOf = (g: Polygon | MultiPolygon): Position[][][] => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

function roundPolygons(polys: Position[][][], dp: number): Position[][][] {
  const k = 10 ** dp;
  return polys.map((poly) => poly.map((ring) => ring.map(([x, y]) => [Math.round(x * k) / k, Math.round(y * k) / k])));
}

/** Area in km²; each polygon's winding is treated as "the smaller side" so flipped rings can't explode. */
function areaKm2(polys: Position[][][]): number {
  let steradians = 0;
  for (const coordinates of polys) {
    const a = geoArea({ type: "Polygon", coordinates });
    steradians += Math.min(a, 4 * Math.PI - a);
  }
  return Math.round(steradians * EARTH_RADIUS_KM ** 2);
}

async function main() {
  const [ne50, ne10] = await Promise.all([load("50m"), load("10m")]);
  const countryByA3 = new Map(COUNTRIES.map((c) => [c.a3, c]));

  // 1. Group 1:50m features by (merged) a3.
  const groups = new Map<string, { label: NEProps; polys: Position[][][] }>();
  for (const f of ne50) {
    const own = f.properties.ADM0_A3;
    const a3 = MERGE[own] ?? own;
    const group = groups.get(a3) ?? { label: f.properties, polys: [] };
    if (own === a3) group.label = f.properties;
    group.polys.push(...polygonsOf(f.geometry));
    groups.set(a3, group);
  }
  for (const c of COUNTRIES) {
    if (!groups.has(c.a3)) throw new Error(`No 1:50m geometry for ${c.name} (${c.a3})`);
  }

  // 2. Land neighbours = shared arcs in a 1:50m topology.
  const ids = [...groups.keys()];
  const topo = topology({
    countries: {
      type: "FeatureCollection",
      features: ids.map((id) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "MultiPolygon" as const, coordinates: groups.get(id)!.polys },
      })),
    },
  });
  const adjacency = neighbors((topo.objects.countries as GeometryCollection).geometries);
  const neighbourPairs = new Set<string>();
  adjacency.forEach((list, i) => list.forEach((j) => neighbourPairs.add(`${ids[i]}|${ids[j]}`)));

  // 3. Output features: 1:10m geometry for tiny countries, 1:50m for everything else.
  const ne10ByA3 = new Map(ne10.map((f) => [f.properties.ADM0_A3, f]));
  const features: Feature<MultiPolygon, CountryFeatureProps>[] = ids.map((a3) => {
    const group = groups.get(a3)!;
    const country = countryByA3.get(a3);
    let polys = group.polys;
    let dp = 3;
    if (country?.tiny) {
      const detailed = ne10ByA3.get(a3);
      if (!detailed) throw new Error(`No 1:10m geometry for tiny country ${country.name} (${a3})`);
      polys = polygonsOf(detailed.geometry);
      dp = 4;
    }
    const coordinates = roundPolygons(polys, dp);
    return {
      type: "Feature",
      properties: {
        a3,
        iso2: country?.iso2 ?? null,
        name: country?.name ?? group.label.ADMIN,
        playable: country !== undefined,
        tiny: country?.tiny === true,
        labelLat: group.label.LABEL_Y,
        labelLng: group.label.LABEL_X,
        areaKm2: areaKm2(coordinates),
      },
      geometry: { type: "MultiPolygon", coordinates },
    };
  });

  // 4. Distances between playable countries (upper triangle, COUNTRIES order).
  const featureByA3 = new Map(features.map((f) => [f.properties.a3, f]));
  const shapes = COUNTRIES.map((c) => buildShape(featureByA3.get(c.a3)!.geometry.coordinates));
  const km: number[] = [];
  const started = Date.now();
  for (let i = 0; i < COUNTRIES.length; i++) {
    for (let j = i + 1; j < COUNTRIES.length; j++) {
      const touching = neighbourPairs.has(`${COUNTRIES[i].a3}|${COUNTRIES[j].a3}`);
      km.push(touching ? 0 : Math.round(minDistanceKm(shapes[i], shapes[j])));
    }
    if (i % 20 === 0) console.log(`distances ${i}/${COUNTRIES.length} (${Math.round((Date.now() - started) / 1000)}s)`);
  }
  const table: DistanceTable = { ids: COUNTRIES.map((c) => c.iso2), km };

  // 5. Write.
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "countries.geojson"), JSON.stringify({ type: "FeatureCollection", features }));
  fs.writeFileSync(path.join(OUT, "distances.json"), JSON.stringify(table));
  console.log(`Wrote ${features.length} features and ${km.length} distances to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Run the build**

Run: `pnpm data:build` (use a timeout of at least 5 minutes)
Expected: download logs, then about 10 progress lines, ending with `Wrote 240 features and 19306 distances to …/public/data`. The exact feature count depends on Natural Earth; there are 242 source features minus 2 merged. If `tsx` fails with `ERR_REQUIRE_ESM`, rename the script to `scripts/build-data.mts`, update the `data:build` script to match, and run it again.

Check the sizes: `ls -la public/data`. Expect `countries.geojson` ≤ ~3 MB and `distances.json` ≈ 80–120 KB.

- [ ] **Step 5: Run the generated-data tests**

Run: `pnpm test src/data/generated.test.ts`
Expected: all pass. If `it`–`sm` or `it`–`va` isn't 0, confirm that the neighbour detection in step 2 of the script uses the 1:50m `groups` and not the output `features`.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-data.ts src/data/generated.test.ts public/data
git commit -m "feat: generate country geometry and nearest-border distance table

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Runtime data loading and WebGL detection

**Files:**
- Create: `src/lib/loadData.ts`, `src/lib/loadData.test.ts`, `src/lib/webgl.ts`

**Interfaces:**
- Consumes: `CountryFeature`, `DistanceTable`, `createDistanceLookup`, `DistanceLookup` (Task 6)
- Produces: `interface GameData { features: CountryFeature[]; distance: DistanceLookup }`, `loadGameData(fetchFn?: (url: string) => Promise<Response>): Promise<GameData>`, `hasWebGL(): boolean`

- [ ] **Step 1: Write the failing test** in `src/lib/loadData.test.ts`

```ts
import { expect, test } from "vitest";
import { loadGameData } from "./loadData";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("loads features and builds a distance lookup", async () => {
  const fetchFn = async (url: string) =>
    url.endsWith("countries.geojson")
      ? json({ type: "FeatureCollection", features: [{ type: "Feature", properties: { iso2: "fr" }, geometry: null }] })
      : json({ ids: ["fr", "es"], km: [0] });
  const data = await loadGameData(fetchFn);
  expect(data.features).toHaveLength(1);
  expect(data.distance("fr", "es")).toBe(0);
});

test("rejects with the failing path on HTTP errors", async () => {
  const fetchFn = async (url: string) => (url.endsWith("distances.json") ? json({}, 404) : json({ features: [] }));
  await expect(loadGameData(fetchFn)).rejects.toThrow("/data/distances.json");
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm test src/lib/loadData.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/loadData.ts` and `src/lib/webgl.ts`**

`src/lib/loadData.ts`:

```ts
import type { FeatureCollection, MultiPolygon } from "geojson";
import { createDistanceLookup, type DistanceLookup } from "./distance";
import type { CountryFeature, CountryFeatureProps, DistanceTable } from "./types";

export interface GameData {
  features: CountryFeature[];
  distance: DistanceLookup;
}

type FetchFn = (url: string) => Promise<Response>;

async function getJson<T>(fetchFn: FetchFn, url: string): Promise<T> {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Failed to load ${url} (HTTP ${response.status})`);
  return (await response.json()) as T;
}

export async function loadGameData(fetchFn: FetchFn = (url) => fetch(url)): Promise<GameData> {
  const [geo, table] = await Promise.all([
    getJson<FeatureCollection<MultiPolygon, CountryFeatureProps>>(fetchFn, "/data/countries.geojson"),
    getJson<DistanceTable>(fetchFn, "/data/distances.json"),
  ]);
  return { features: geo.features, distance: createDistanceLookup(table) };
}
```

`src/lib/webgl.ts`:

```ts
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run and verify it passes, then commit**

Run: `pnpm test src/lib/loadData.test.ts`
Expected: 2 passed.

```bash
git add src/lib/loadData.ts src/lib/loadData.test.ts src/lib/webgl.ts
git commit -m "feat: add runtime data loader and WebGL check

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Game state reducer and secret picking

**Files:**
- Create: `src/game/reducer.ts`, `src/game/reducer.test.ts`

**Interfaces:**
- Consumes: `COUNTRIES`, `COUNTRY_BY_ISO`, `Country` (Task 2)
- Produces:
  ```ts
  const TINY_ROUND_P = 0.1;
  type Status = "playing" | "won" | "gaveUp";
  interface Guess { iso2: string; km: number | null; order: number }
  interface Focus { iso2: string; seq: number; repeat: boolean }
  interface GameState { secret: string; difficult: boolean; guesses: Guess[]; status: Status; overlayOn: boolean; focus: Focus | null }
  type GameAction =
    | { type: "GUESS"; iso2: string; km: number | null }
    | { type: "GIVE_UP" }
    | { type: "NEW_GAME"; secret: string }
    | { type: "TOGGLE_OVERLAY" };
  function pickSecret(rand: () => number, previous: string | null, countries?: Country[]): string;
  function createGame(secret: string, overlayOn?: boolean): GameState;
  function gameReducer(state: GameState, action: GameAction): GameState;
  function sortedGuesses(guesses: Guess[]): Guess[]; // km asc, null last, ties by order
  ```

- [ ] **Step 1: Write the failing tests** in `src/game/reducer.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { COUNTRIES } from "@/src/data/countries";
import { createGame, gameReducer, pickSecret, sortedGuesses, TINY_ROUND_P, type GameState } from "./reducer";

/** Deterministic rand that returns the given values in order. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const firstTiny = COUNTRIES.find((c) => c.tiny)!.iso2; // "ad"
const firstRegular = COUNTRIES.find((c) => !c.tiny)!.iso2; // "af"
const secondRegular = COUNTRIES.filter((c) => !c.tiny)[1].iso2; // "al"

describe("pickSecret", () => {
  test("uses the tiny pool when rand < TINY_ROUND_P", () => {
    expect(pickSecret(seq(TINY_ROUND_P - 0.01, 0), null)).toBe(firstTiny);
  });
  test("uses the regular pool otherwise", () => {
    expect(pickSecret(seq(0.5, 0), null)).toBe(firstRegular);
  });
  test("never repeats the previous secret", () => {
    expect(pickSecret(seq(0.5, 0), firstRegular)).toBe(secondRegular);
  });
  test("difficult rounds happen roughly 1 in 10 times", () => {
    let tiny = 0;
    let x = 0.123;
    const rand = () => (x = (x * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 5000; i++) if (createGame(pickSecret(rand, null)).difficult) tiny++;
    expect(tiny / 5000).toBeGreaterThan(0.07);
    expect(tiny / 5000).toBeLessThan(0.13);
  });
});

describe("gameReducer", () => {
  const start = (): GameState => createGame("fr");

  test("createGame flags tiny secrets as difficult", () => {
    expect(createGame("fr").difficult).toBe(false);
    expect(createGame("gd").difficult).toBe(true);
  });

  test("a guess is recorded and focused", () => {
    const s = gameReducer(start(), { type: "GUESS", iso2: "es", km: 0 });
    expect(s.guesses).toEqual([{ iso2: "es", km: 0, order: 1 }]);
    expect(s.status).toBe("playing");
    expect(s.focus).toEqual({ iso2: "es", seq: 1, repeat: false });
  });

  test("a repeated guess is not added but refocuses", () => {
    let s = gameReducer(start(), { type: "GUESS", iso2: "es", km: 0 });
    s = gameReducer(s, { type: "GUESS", iso2: "es", km: 0 });
    expect(s.guesses).toHaveLength(1);
    expect(s.focus).toEqual({ iso2: "es", seq: 2, repeat: true });
  });

  test("guessing the secret wins and later guesses are ignored", () => {
    const s = gameReducer(start(), { type: "GUESS", iso2: "fr", km: 0 });
    expect(s.status).toBe("won");
    const after = gameReducer(s, { type: "GUESS", iso2: "de", km: 0 });
    expect(after).toBe(s);
  });

  test("give up reveals the secret", () => {
    const s = gameReducer(start(), { type: "GIVE_UP" });
    expect(s.status).toBe("gaveUp");
    expect(s.focus?.iso2).toBe("fr");
  });

  test("new game resets but keeps the overlay setting", () => {
    let s = gameReducer(start(), { type: "TOGGLE_OVERLAY" });
    s = gameReducer(s, { type: "GUESS", iso2: "es", km: 0 });
    s = gameReducer(s, { type: "NEW_GAME", secret: "gd" });
    expect(s).toEqual({ secret: "gd", difficult: true, guesses: [], status: "playing", overlayOn: true, focus: null });
  });
});

test("sortedGuesses orders by distance, unknown last, ties by order", () => {
  const sorted = sortedGuesses([
    { iso2: "a", km: 500, order: 1 },
    { iso2: "b", km: null, order: 2 },
    { iso2: "c", km: 0, order: 3 },
    { iso2: "d", km: 500, order: 4 },
  ]);
  expect(sorted.map((g) => g.iso2)).toEqual(["c", "a", "d", "b"]);
});
```

- [ ] **Step 2: Run them and verify they fail**

Run: `pnpm test src/game/reducer.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/game/reducer.ts`**

```ts
import { COUNTRIES, COUNTRY_BY_ISO, type Country } from "@/src/data/countries";

/** Share of rounds whose secret is a tiny country, independent of how many tiny countries exist. */
export const TINY_ROUND_P = 0.1;

export type Status = "playing" | "won" | "gaveUp";

export interface Guess {
  iso2: string;
  km: number | null;
  order: number;
}

/** Where the camera should fly. `seq` changes on every request so repeats still trigger. */
export interface Focus {
  iso2: string;
  seq: number;
  repeat: boolean;
}

export interface GameState {
  secret: string;
  difficult: boolean;
  guesses: Guess[];
  status: Status;
  overlayOn: boolean;
  focus: Focus | null;
}

export type GameAction =
  | { type: "GUESS"; iso2: string; km: number | null }
  | { type: "GIVE_UP" }
  | { type: "NEW_GAME"; secret: string }
  | { type: "TOGGLE_OVERLAY" };

export function pickSecret(rand: () => number, previous: string | null, countries: Country[] = COUNTRIES): string {
  const wantTiny = rand() < TINY_ROUND_P;
  const pool = countries.filter((c) => (c.tiny === true) === wantTiny && c.iso2 !== previous);
  return pool[Math.floor(rand() * pool.length)].iso2;
}

export function createGame(secret: string, overlayOn = false): GameState {
  return {
    secret,
    difficult: COUNTRY_BY_ISO.get(secret)?.tiny === true,
    guesses: [],
    status: "playing",
    overlayOn,
    focus: null,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const nextSeq = (state.focus?.seq ?? 0) + 1;
  switch (action.type) {
    case "GUESS": {
      if (state.status !== "playing") return state;
      if (state.guesses.some((g) => g.iso2 === action.iso2)) {
        return { ...state, focus: { iso2: action.iso2, seq: nextSeq, repeat: true } };
      }
      const guess: Guess = { iso2: action.iso2, km: action.km, order: state.guesses.length + 1 };
      return {
        ...state,
        guesses: [...state.guesses, guess],
        status: action.iso2 === state.secret ? "won" : "playing",
        focus: { iso2: action.iso2, seq: nextSeq, repeat: false },
      };
    }
    case "GIVE_UP":
      if (state.status !== "playing") return state;
      return { ...state, status: "gaveUp", focus: { iso2: state.secret, seq: nextSeq, repeat: false } };
    case "NEW_GAME":
      return createGame(action.secret, state.overlayOn);
    case "TOGGLE_OVERLAY":
      return { ...state, overlayOn: !state.overlayOn };
  }
}

export function sortedGuesses(guesses: Guess[]): Guess[] {
  const key = (g: Guess) => g.km ?? Number.POSITIVE_INFINITY;
  return [...guesses].sort((a, b) => key(a) - key(b) || a.order - b.order);
}
```

- [ ] **Step 4: Run and verify they pass, then commit**

Run: `pnpm test src/game/reducer.test.ts`
Expected: all pass.

```bash
git add src/game
git commit -m "feat: add game reducer with weighted difficult rounds

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Globe view

**Files:**
- Create: `src/components/GlobeView.tsx`

**Interfaces:**
- Consumes: `CountryFeature` (Task 6), `hexToRgb` (Task 4), `ringAlpha`, `labelMaxAltitude` (Task 4)
- Produces: the default export `GlobeView` with these props:
  ```ts
  interface GlobeViewProps {
    features: CountryFeature[];
    colors: ReadonlyMap<string, string>; // iso2 → fill colour for guessed/revealed countries
    outlined: string | null;              // iso2 drawn with a white outline (give-up reveal)
    overlayOn: boolean;
    focus: { iso2: string; seq: number } | null;
  }
  ```

Notes checked against the installed `react-globe.gl` 2.38 typings:
- `ref` is `MutableRefObject<GlobeMethods | undefined>`.
- `pointOfView({lat,lng,altitude}, ms)` flies the camera.
- `controls()` returns the three.js `OrbitControls`. globe.gl already scales rotate and zoom speed with altitude, so there's nothing to add for that.
- The camera distance is `globeRadius * (1 + altitude)`.
- `htmlElementVisibilityModifier(el, isVisible)` hides labels on the far side of the globe.

This task has no unit test; it is checked visually in Task 12. Keep accessors memoised so polygons are not rebuilt on every zoom tick.

- [ ] **Step 1: Create `src/components/GlobeView.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial } from "three";
import { hexToRgb } from "@/src/lib/heat";
import type { CountryFeature } from "@/src/lib/types";
import { labelMaxAltitude, ringAlpha } from "@/src/lib/zoom";

export interface GlobeViewProps {
  features: CountryFeature[];
  colors: ReadonlyMap<string, string>;
  outlined: string | null;
  overlayOn: boolean;
  focus: { iso2: string; seq: number } | null;
}

const SPACE = "#050814";
const OCEAN = "#0b2a4a";
const LAND = "#3f4a5a";
const OVERLAY_BORDER = "rgba(255,255,255,0.45)";
const GUESSED_BORDER = "rgba(15,23,42,0.9)";
const REVEAL_BORDER = "#ffffff";
const NEUTRAL_RING = "#e5e7eb";

const MIN_ALTITUDE = 0.025;
const MAX_ALTITUDE = 4;
const INITIAL_ALTITUDE = 2.5;
const FLY_MS = 1200;

interface LabelDatum {
  lat: number;
  lng: number;
  name: string;
  maxAlt: number;
}

interface RingDatum {
  lat: number;
  lng: number;
  color: string;
}

const isoOf = (d: object) => (d as CountryFeature).properties.iso2;
// Module-level so their identity is stable. A new function per render makes react-globe.gl rebuild the layer.
const sideColor = () => "rgba(0,0,0,0.25)";
const markLabelSide = (el: HTMLElement, visible: boolean) => {
  el.dataset.front = String(visible);
};

export default function GlobeView({ features, colors, outlined, overlayOn, focus }: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [altitude, setAltitude] = useState(INITIAL_ALTITUDE);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const oceanMaterial = useMemo(() => new MeshPhongMaterial({ color: OCEAN, shininess: 6 }), []);

  const byIso = useMemo(
    () => new Map(features.filter((f) => f.properties.iso2).map((f) => [f.properties.iso2 as string, f])),
    [features],
  );

  const handleReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const r = globe.getGlobeRadius();
    const controls = globe.controls();
    controls.minDistance = r * (1 + MIN_ALTITUDE);
    controls.maxDistance = r * (1 + MAX_ALTITUDE);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
    });
    globe.pointOfView({ altitude: INITIAL_ALTITUDE });
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    const feature = focus ? byIso.get(focus.iso2) : undefined;
    if (!globe || !feature) return;
    globe.controls().autoRotate = false;
    const { labelLat, labelLng, tiny } = feature.properties;
    globe.pointOfView({ lat: labelLat, lng: labelLng, altitude: tiny ? 0.4 : 2 }, FLY_MS);
  }, [focus, byIso]);

  const handleZoom = useCallback(({ altitude: alt }: { altitude: number }) => {
    containerRef.current?.querySelectorAll<HTMLElement>(".globe-label").forEach((el) => {
      el.dataset.zoomHidden = String(alt > Number(el.dataset.maxAlt));
    });
    const rounded = Math.round(alt * 50) / 50;
    setAltitude((prev) => (prev === rounded ? prev : rounded));
  }, []);

  // Polygon accessors: only change when game colours / overlay change, not on zoom.
  const capColor = useCallback((d: object) => colors.get(isoOf(d) ?? "") ?? LAND, [colors]);
  const strokeColor = useCallback(
    (d: object) => {
      const iso = isoOf(d);
      if (iso && iso === outlined) return REVEAL_BORDER;
      if (iso && colors.has(iso)) return GUESSED_BORDER;
      return overlayOn ? OVERLAY_BORDER : false;
    },
    [colors, outlined, overlayOn],
  );
  const polygonAltitude = useCallback((d: object) => (colors.has(isoOf(d) ?? "") ? 0.006 : 0.002), [colors]);
  const polygonLabel = useCallback(
    (d: object) => {
      const f = d as CountryFeature;
      const known = f.properties.iso2 !== null && colors.has(f.properties.iso2);
      return known || overlayOn ? `<b>${f.properties.name}</b>` : "";
    },
    [colors, overlayOn],
  );

  const labelData = useMemo<LabelDatum[]>(
    () =>
      features
        .filter((f) => f.properties.playable || (f.properties.areaKm2 > 100_000 && f.properties.a3 !== "ATA"))
        .map((f) => ({
          lat: f.properties.labelLat,
          lng: f.properties.labelLng,
          name: f.properties.name,
          maxAlt: labelMaxAltitude(f.properties.areaKm2),
        })),
    [features],
  );

  const makeLabel = useCallback((d: object) => {
    const label = d as LabelDatum;
    const el = document.createElement("div");
    el.className = "globe-label";
    el.textContent = label.name;
    el.dataset.maxAlt = String(label.maxAlt);
    el.dataset.big = String(label.maxAlt === Infinity);
    const alt = globeRef.current?.pointOfView().altitude ?? INITIAL_ALTITUDE;
    el.dataset.zoomHidden = String(alt > label.maxAlt);
    return el;
  }, []);

  const ringData = useMemo<RingDatum[]>(
    () =>
      features
        .filter((f) => f.properties.tiny && f.properties.iso2 && (colors.has(f.properties.iso2) || overlayOn))
        .map((f) => ({
          lat: f.properties.labelLat,
          lng: f.properties.labelLng,
          color: colors.get(f.properties.iso2 as string) ?? NEUTRAL_RING,
        })),
    [features, colors, overlayOn],
  );

  const alpha = ringAlpha(altitude);
  const ringColor = useCallback(
    (d: object) => {
      const [r, g, b] = hexToRgb((d as RingDatum).color);
      return (t: number) => `rgba(${r},${g},${b},${((1 - t) * alpha).toFixed(3)})`;
    },
    [alpha],
  );

  return (
    <div ref={containerRef} className="absolute inset-0">
      {size.width > 0 && size.height > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor={SPACE}
          globeMaterial={oceanMaterial}
          showAtmosphere
          atmosphereColor="#5b8def"
          atmosphereAltitude={0.15}
          onGlobeReady={handleReady}
          onZoom={handleZoom}
          polygonsData={features}
          polygonCapColor={capColor}
          polygonSideColor={sideColor}
          polygonStrokeColor={strokeColor}
          polygonAltitude={polygonAltitude}
          polygonLabel={polygonLabel}
          polygonsTransitionDuration={300}
          ringsData={ringData}
          ringLat="lat"
          ringLng="lng"
          ringAltitude={0.007}
          ringColor={ringColor}
          ringMaxRadius={1.5}
          ringPropagationSpeed={1.2}
          ringRepeatPeriod={1400}
          htmlElementsData={overlayOn ? labelData : []}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.008}
          htmlElement={makeLabel}
          htmlElementVisibilityModifier={markLabelSide}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. If the `ref={globeRef}` typing complains, use `useRef<GlobeMethods>(undefined)`. The prop type is `MutableRefObject<GlobeMethods | undefined>`, and either form is structurally `{ current }`.

- [ ] **Step 3: Commit**

```bash
git add src/components/GlobeView.tsx
git commit -m "feat: add 3D globe view with heat colours, rings, labels and fly-to

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Game UI (input, panel, banners, page wiring)

**Files:**
- Create: `src/components/GuessInput.tsx`, `src/components/TopBar.tsx`, `src/components/GuessList.tsx`, `src/components/ResultBanner.tsx`, `src/components/DifficultNotice.tsx`, `src/components/Game.tsx`, `src/components/GameLoader.tsx`
- Replace: `app/page.tsx`, `app/globals.css`
- Modify: `app/layout.tsx`
- Delete: `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg` (unused scaffold assets)

**Interfaces:**
- Consumes: `matchCountry`, `excludedMessage`, `MatchResult` (Task 3); `normalize` (Task 2); `COUNTRY_BY_ISO`, `Country` (Task 2); `heatColor`, `WIN_COLOR` (Task 4); `formatClue` (Task 4); `loadGameData`, `GameData` (Task 8); `hasWebGL` (Task 8); `gameReducer`, `createGame`, `pickSecret`, `sortedGuesses`, `Guess`, `Status` (Task 9); `GlobeView` (Task 10)

- [ ] **Step 1: Read the Next docs** for the pieces used here: `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` (`ssr: false` must live in a Client Component), and the layout/metadata basics under `01-app/`.

- [ ] **Step 2: Replace `app/globals.css`**

```css
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@theme {
  --color-space: #050814;
  --color-panel: #0c1322;

  --animate-shake: shake 0.35s ease-in-out;
  --animate-flash: flash 1.5s ease-out;
  --animate-pop: pop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1);

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
  }
  @keyframes flash {
    from { background-color: rgb(250 204 21 / 0.35); }
    to { background-color: transparent; }
  }
  @keyframes pop {
    0% { transform: scale(0.6); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
}

html,
body {
  height: 100%;
}

body {
  background: var(--color-space);
  color: #e2e8f0;
}

/* Country-name labels rendered by the globe's HTML layer (overlay mode). */
.globe-label {
  color: #f8fafc;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 0 3px #000, 0 0 6px #000;
}
.globe-label[data-big="true"] {
  font-size: 14px;
}
.globe-label[data-front="false"],
.globe-label[data-zoom-hidden="true"] {
  display: none;
}
```

- [ ] **Step 3: Update `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Country Guess Globe",
  description: "Guess the secret country on a 3D globe — the redder, the closer.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Create `src/components/GuessInput.tsx`**

```tsx
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
        className={`w-full rounded-lg border border-white/15 bg-slate-900/80 px-4 py-2.5 text-base text-white shadow-lg outline-none backdrop-blur placeholder:text-slate-400 focus:border-sky-400 disabled:opacity-60 ${
          shaking ? "animate-shake" : ""
        }`}
      />
      <div className="mt-1.5 min-h-6 text-sm" aria-live="polite">
        {result?.kind === "suggest" ? (
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
```

- [ ] **Step 5: Create `src/components/TopBar.tsx`**

```tsx
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
```

- [ ] **Step 6: Create `src/components/GuessList.tsx`**

```tsx
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
```

- [ ] **Step 7: Create `src/components/ResultBanner.tsx` and `src/components/DifficultNotice.tsx`**

`src/components/ResultBanner.tsx`:

```tsx
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
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-200"
        >
          New game
        </button>
      </div>
    </div>
  );
}
```

`src/components/DifficultNotice.tsx`:

```tsx
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
```

- [ ] **Step 8: Create `src/components/Game.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { COUNTRY_BY_ISO, type Country } from "@/src/data/countries";
import { createGame, gameReducer, pickSecret } from "@/src/game/reducer";
import { heatColor, WIN_COLOR } from "@/src/lib/heat";
import { loadGameData, type GameData } from "@/src/lib/loadData";
import { hasWebGL } from "@/src/lib/webgl";
import DifficultNotice from "./DifficultNotice";
import GlobeView from "./GlobeView";
import GuessInput from "./GuessInput";
import GuessList from "./GuessList";
import ResultBanner from "./ResultBanner";
import TopBar from "./TopBar";

/** In development, `?secret=gd` forces the secret country (used for manual testing). */
function initialSecret(): string {
  if (process.env.NODE_ENV !== "production") {
    const forced = new URLSearchParams(window.location.search).get("secret")?.toLowerCase();
    if (forced && COUNTRY_BY_ISO.has(forced)) return forced;
  }
  return pickSecret(Math.random, null);
}

export default function Game() {
  const [webgl] = useState(hasWebGL);
  const [data, setData] = useState<GameData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, dispatch] = useReducer(gameReducer, null, () => createGame(initialSecret()));

  useEffect(() => {
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
  }, [attempt]);

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

  function newGame() {
    dispatch({ type: "NEW_GAME", secret: pickSecret(Math.random, state.secret) });
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
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 p-3 md:p-4">
          <div className="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-2">
            <GuessInput
              key={state.secret}
              onGuess={handleGuess}
              disabled={state.status !== "playing"}
              externalMessage={repeatName ? `You already guessed ${repeatName}.` : null}
            />
            <TopBar
              guessCount={state.guesses.length}
              overlayOn={state.overlayOn}
              canGiveUp={state.status === "playing"}
              onToggleOverlay={() => dispatch({ type: "TOGGLE_OVERLAY" })}
              onGiveUp={() => dispatch({ type: "GIVE_UP" })}
              onNewGame={newGame}
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
      <aside className="h-[40vh] border-t border-white/10 bg-panel md:h-auto md:w-80 md:border-l md:border-t-0">
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
```

- [ ] **Step 9: Create `src/components/GameLoader.tsx` and replace `app/page.tsx`**

`src/components/GameLoader.tsx`:

```tsx
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
```

`app/page.tsx`:

```tsx
import GameLoader from "@/src/components/GameLoader";

export default function Home() {
  return <GameLoader />;
}
```

- [ ] **Step 10: Remove unused scaffold assets**

```bash
rm public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
```

- [ ] **Step 11: Type-check, lint, test, build**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build`
Expected: all succeed. If lint flags `react-hooks/set-state-in-effect` in `Game.tsx`, check that the only `setState` calls in effects are inside promise callbacks, as written above.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add game UI with did-you-mean input, guess panel and banners

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Play-through verification and README

**Files:**
- Modify: `README.md`
- Modify (only if verification finds problems): any file from Tasks 10–11

**Interfaces:**
- Consumes: the whole app. The dev-only `?secret=xx` override comes from Task 11.

- [ ] **Step 1: Start the dev server** in the background: `pnpm dev`. Wait for `Ready`, then note the URL (normally `http://localhost:3000`).

- [ ] **Step 2: Drive a full round in Chrome** with the Chrome DevTools MCP tools (`new_page`, `fill`/`type_text`, `press_key`, `click`, `take_screenshot`, `list_console_messages`, `evaluate_script`). Open `http://localhost:3000/?secret=pe` (Peru) and check each item, taking a screenshot where noted:
  1. The globe renders: dark ocean, slate land, no borders or labels, slowly auto-rotating. *(screenshot)*
  2. Type `Argentinia` + Enter. The input shakes and "Did you mean: **Argentina**" appears. Enter again: Argentina is guessed, the camera flies to it, it's colored red-orange, and the panel shows the flag and "Shares a border!" *(screenshot)*
  3. Type `Japan` + Enter: pale color, and the panel row reads "Closest border: …km". Rows are sorted with Argentina on top.
  4. Type `Argentina` again: "You already guessed Argentina." appears and the camera flies back.
  5. Type `Greenland`: the territory message appears and the guess count doesn't change.
  6. Click **Show names & borders**: borders appear and big-country labels are visible. Scroll-zoom into Europe; smaller labels appear as you zoom in. *(screenshot)*
  7. Type `Peru`: it turns green, the win banner "🎉 Found it in 4 guesses!" appears, and the input is disabled. *(screenshot)*
  8. Click **New game**: the list is emptied and the overlay stays on.
  9. Open `http://localhost:3000/?secret=gd`: the amber "⚠️ Difficult round…" notice shows. Guess `Barbados`: the camera flies close and a colored ring pulses. Zoom in all the way: the ring fades and the island's colored shape is visible. The camera can't go below about 160 km. *(screenshot)*
  10. Click **Give up**: the camera flies to Grenada, which is green with a white outline, and the banner says "It was Grenada." *(screenshot)*
  11. `list_console_messages` shows no errors.
  12. Resize to 390×844 (`resize_page`): the panel stacks under the globe and the input is usable. *(screenshot)*

  If anything fails, use superpowers:systematic-debugging, fix it in the relevant component, and repeat the failing check.

- [ ] **Step 3: Update `README.md`** (replace the scaffold text):

````markdown
# Country Guess Globe

Guess the secret country on a 3D globe. Each guess is colored by how close its nearest border is to the secret country: deep red means neighbours, pale means far away, and green means found. The panel on the right lists your guesses with flags and the distance clue. **Show names & borders** turns on a learning overlay.

About 1 in 10 rounds is a **difficult round**, where the secret is a micro-state (land < 1,000 km²). Zoom in close to see them.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000  (dev only: ?secret=fr forces the secret)
pnpm test         # unit + data tests
pnpm lint
pnpm build
```

## Data

`public/data/countries.geojson` and `public/data/distances.json` are generated from [Natural Earth](https://www.naturalearthdata.com/) admin-0 boundaries and committed:

```bash
pnpm data:build   # downloads into .cache/, ~1–2 minutes
```

Countries live in `src/data/countries.ts`. Recognised non-country places are in `src/data/excluded.ts`, documented in `docs/excluded-countries.md`.
````

- [ ] **Step 4: Final checks and commit**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: all pass.

```bash
git add -A
git commit -m "docs: add README; verify full play-through

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
