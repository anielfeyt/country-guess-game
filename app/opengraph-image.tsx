import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { formatClue } from "@/src/lib/format";
import { ART_SPACE, DEMO_SECRET, loadDemoRound, renderGlobeSvg, svgDataUri } from "@/src/lib/globeArt";

export const alt = "Country Guess Globe: a 3D globe where guessed countries glow redder the closer they are to the secret country";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE = "Country Guess Globe";
const GLOBE = 820;

const EYEBROW = "A geography guessing game";
const TAGLINE = "Find the secret country on a 3D globe. The redder, the closer.";

/** Geist subset (only the glyphs in `text`) from Google Fonts, or null when offline. */
async function loadGeist(weight: 400 | 700, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Geist:wght@${weight}&text=${encodeURIComponent(text)}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

// Passing any fonts drops next/og's default, so its bundled Geist Regular is the offline fallback.
const bundledGeist = () => readFile(join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"));

const flag = async (iso2: string) =>
  svgDataUri(await readFile(join(process.cwd(), "node_modules/flag-icons/flags/4x3", `${iso2}.svg`), "utf8"));

// Deterministic star field so the build output is stable.
function stars(): string {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dots = Array.from({ length: 90 }, () => {
    const r = rand() < 0.85 ? 0.8 : 1.5;
    return `<circle cx="${(rand() * 1200).toFixed(1)}" cy="${(rand() * 630).toFixed(1)}" r="${r}" fill="#fff" opacity="${(0.15 + rand() * 0.5).toFixed(2)}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">${dots.join("")}</svg>`;
}

export default async function Image() {
  const round = await loadDemoRound();
  // Found country on top, then closest first, as in the in-game list.
  const rank = (g: (typeof round.guesses)[number]) => (g.iso2 === DEMO_SECRET ? -1 : (g.km ?? Infinity));
  const rows = [...round.guesses].sort((a, b) => rank(a) - rank(b)).slice(0, 3);
  const clue = (g: (typeof rows)[number]) => (g.iso2 === DEMO_SECRET ? "Found it!" : formatClue(g.km));
  const bodyText = [EYEBROW.toUpperCase(), TAGLINE, ...rows.flatMap((g) => [g.name, clue(g)])].join("");
  const [regular, bold, flags] = await Promise.all([
    loadGeist(400, bodyText).then((f): Promise<ArrayBuffer | Buffer> => (f ? Promise.resolve(f) : bundledGeist())),
    loadGeist(700, TITLE),
    Promise.all(rows.map((g) => flag(g.iso2))),
  ]);
  const globe = renderGlobeSvg(round.features, {
    size: GLOBE,
    rotate: [14, -22],
    colors: round.colors,
    borderWidth: 0.7,
    graticule: true,
    glow: true,
  });

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: ART_SPACE, position: "relative", fontFamily: "Geist" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgDataUri(stars())} width={1200} height={630} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={svgDataUri(globe)}
          width={GLOBE}
          height={GLOBE}
          alt=""
          style={{ position: "absolute", left: 500, top: (630 - GLOBE) / 2 }}
        />
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 60,
            width: 480,
            display: "flex",
            flexDirection: "column",
            color: "#e2e8f0",
          }}
        >
          <div style={{ fontSize: 18, letterSpacing: 4, color: "#7ea6ff", textTransform: "uppercase" }}>
            {EYEBROW}
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: -2,
              color: "#f8fafc",
            }}
          >
            {TITLE}
          </div>
          <div style={{ marginTop: 20, fontSize: 27, lineHeight: 1.35, color: "#94a3b8" }}>
            {TAGLINE}
          </div>
          <div
            style={{
              marginTop: 30,
              display: "flex",
              flexDirection: "column",
              background: "rgba(12, 19, 34, 0.88)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {rows.map((g, i) => (
              <div
                key={g.iso2}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 20px",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={flags[i]} width={40} height={30} alt="" style={{ borderRadius: 4 }} />
                <div style={{ display: "flex", flexDirection: "column", marginLeft: 16, flex: 1 }}>
                  <div style={{ fontSize: 22, color: "#f1f5f9" }}>{g.name}</div>
                  <div style={{ fontSize: 16, color: "#94a3b8" }}>
                    {clue(g)}
                  </div>
                </div>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    background: g.color,
                    border: "2px solid rgba(255, 255, 255, 0.25)",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        ...(bold ? [{ name: "Geist", data: bold, weight: 700 as const, style: "normal" as const }] : []),
      ],
    },
  );
}
