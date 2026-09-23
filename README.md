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

Countries live in `src/data/countries.ts`. Recognised non-country places are in `src/data/excluded.ts`, documented in `docs/excluded-countries.md`. Some of France's and the Netherlands' overseas regions (e.g. French Guiana, the Caribbean Netherlands) are part of those countries' map features, so they're drawn, coloured and counted in distances as France/the Netherlands, even though guessing their own name shows the "not a country" message.
