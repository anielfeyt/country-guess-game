# Country Guess Globe

Guess the secret country on a 3D globe. Each guess is colored by how close its nearest border is to the secret country: deep red means neighbours, pale means far away, and green means found. The panel on the right lists your guesses with flags and the distance clue. **Show names & borders** turns on a learning overlay.

Pick a **difficulty** in the side panel; it sets which countries the secret is drawn from, by land area:

- **Easy**: the 71 largest countries (300,000 km² and up)
- **Moderate**: 56 mid-size countries, down to the Dominican Republic
- **Hard**: the 70 countries smaller than the Dominican Republic

On Hard, the secret may be a micro-state (land < 1,000 km²). That's flagged as a **difficult round**; zoom in close to see them. You can guess any country at every level.

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
